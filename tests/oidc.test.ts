import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthUrl, googleEndpoints, pkceChallenge, randomToken, verifyIdToken, type Jwks } from '../lib/oidc.ts';

const b64u = (b: Uint8Array | string) => Buffer.from(b).toString('base64url');
const AUD = 'client-123';
const ISS = 'https://accounts.google.com';
const NOW = Date.parse('2026-01-01T00:00:00Z');

async function keypair() {
  const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1' };
  return { kp, jwks: { keys: [jwk] } as Jwks };
}

async function mint(kp: CryptoKeyPair, claims: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1' }) {
  const body = { iss: ISS, aud: AUD, exp: NOW / 1000 + 3600, nonce: 'n1', sub: 'sub-1', email: 'a@airasia.com', email_verified: true, ...claims };
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(body))}`;
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(input)));
  return `${input}.${b64u(sig)}`;
}

const expect = { audience: AUD, nonce: 'n1', issuers: [ISS, 'accounts.google.com'], nowMs: NOW };

test('valid ID token passes and returns the claims', async () => {
  const { kp, jwks } = await keypair();
  const r = await verifyIdToken(await mint(kp, {}), jwks, expect);
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.claims.email, 'a@airasia.com');
});

test('rejects every way a token can be wrong', async () => {
  const { kp, jwks } = await keypair();
  const other = await keypair();
  const cases: Array<[string, string, string]> = [
    ['signature (other key)', await mint(other.kp, {}), 'signature'],
    ['issuer', await mint(kp, { iss: 'https://evil.test' }), 'iss'],
    ['audience', await mint(kp, { aud: 'someone-else' }), 'aud'],
    ['expired', await mint(kp, { exp: NOW / 1000 - 1 }), 'exp'],
    ['nonce (replay)', await mint(kp, { nonce: 'other' }), 'nonce'],
    ['unverified email', await mint(kp, { email_verified: false }), 'email_unverified'],
    ['alg none/HS256', await mint(kp, {}, { alg: 'HS256', kid: 'k1' }), 'alg'],
    ['unknown kid', await mint(kp, {}, { alg: 'RS256', kid: 'zzz' }), 'kid'],
  ];
  for (const [name, token, reason] of cases) {
    const r = await verifyIdToken(token, jwks, expect);
    assert.deepEqual([name, r.ok, !r.ok && r.reason], [name, false, reason]);
  }
  assert.equal((await verifyIdToken('not.a.jwt', jwks, expect)).ok, false);
  assert.equal((await verifyIdToken('x', jwks, expect)).ok, false);
});

test('allowed domain is enforced through the hd claim', async () => {
  const { kp, jwks } = await keypair();
  assert.equal((await verifyIdToken(await mint(kp, { hd: 'airasia.com' }), jwks, { ...expect, allowedDomain: 'airasia.com' })).ok, true);
  const bad = await verifyIdToken(await mint(kp, { hd: 'gmail.com' }), jwks, { ...expect, allowedDomain: 'airasia.com' });
  assert.deepEqual([bad.ok, !bad.ok && bad.reason], [false, 'domain']);
  assert.equal((await verifyIdToken(await mint(kp, {}), jwks, { ...expect, allowedDomain: 'airasia.com' })).ok, false, 'personal accounts have no hd');
});

test('PKCE S256 matches the RFC 7636 test vector', async () => {
  assert.equal(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.notEqual(randomToken(), randomToken());
});

test('auth URL carries state, nonce, PKCE and uses the fixed Google host', () => {
  const url = new URL(buildAuthUrl(googleEndpoints, { clientId: AUD, redirectUri: 'https://x.test/cb', state: 's', nonce: 'n', challenge: 'c', hd: 'airasia.com' }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  for (const [k, v] of Object.entries({ response_type: 'code', code_challenge_method: 'S256', state: 's', nonce: 'n', hd: 'airasia.com' })) {
    assert.equal(url.searchParams.get(k), v);
  }
  assert.equal(googleEndpoints.token, 'https://oauth2.googleapis.com/token');
});
