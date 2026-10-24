import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createFlashCookie, createOAuthCookie, createRateLimiter, createSessionToken, isSameOrigin, readAuthConfig,
  readFlashCookie, readOAuthCookie, safeNext, verifySessionToken,
} from '../lib/auth-core.ts';

const SECRET = 'x'.repeat(32);
const WHO = { uid: 'u-1', email: 'a@airasia.com' };
const T0 = Date.parse('2026-01-01T00:00:00Z');

test('session token carries identity, expires and rejects tampering', async () => {
  const token = await createSessionToken(SECRET, WHO, T0);
  assert.deepEqual(await verifySessionToken(token, SECRET, T0 + 1000), WHO);
  assert.equal(await verifySessionToken(token, SECRET, T0 + 9 * 3600 * 1000), null, 'expired');
  assert.equal(await verifySessionToken(token, 'y'.repeat(32), T0 + 1000), null, 'wrong secret');
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'admin', email: 'boss@airasia.com', typ: 's', exp: 9999999999 })).toString('base64url');
  assert.equal(await verifySessionToken(`${forged}.${sig}`, SECRET, T0), null, 'forged payload with a stolen signature');
  assert.equal(await verifySessionToken(`${payload}.${sig.slice(0, -2)}AA`, SECRET, T0), null, 'bad signature');
  for (const bad of ['', 'a', 'a.b.c', '.', undefined]) assert.equal(await verifySessionToken(bad, SECRET, T0), null);
});

test('a flash or oauth cookie can never be used as a session', async () => {
  const flash = await createFlashCookie(SECRET, { reason: 'not_registered', email: 'x@y.com' }, T0);
  const oauth = await createOAuthCookie(SECRET, { state: 's', nonce: 'n', verifier: 'v', next: '/' }, T0);
  assert.equal(await verifySessionToken(flash, SECRET, T0), null);
  assert.equal(await verifySessionToken(oauth, SECRET, T0), null);
  assert.equal((await readFlashCookie(flash, SECRET, T0))?.email, 'x@y.com');
  assert.equal(await readFlashCookie(oauth, SECRET, T0), null);
  assert.equal((await readOAuthCookie(oauth, SECRET, T0))?.verifier, 'v');
  assert.equal(await readOAuthCookie(oauth, SECRET, T0 + 11 * 60 * 1000), null, 'oauth cookie lives 10 min');
});

test('auth config needs a secret and the Google client', () => {
  const full = { AUTH_SECRET: SECRET, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'sec' };
  assert.equal(readAuthConfig({}).configured, false);
  assert.equal(readAuthConfig({ ...full, AUTH_SECRET: 'tiny' }).configured, false);
  assert.equal(readAuthConfig({ ...full, GOOGLE_CLIENT_ID: '' }).configured, false);
  const c = readAuthConfig({ ...full, APP_URL: 'https://x.test/', CONTACT_WHATSAPP: '+60 12-345 6789', GOOGLE_ALLOWED_DOMAIN: 'AirAsia.com' });
  assert.equal(c.configured, true);
  assert.equal(c.appUrl, 'https://x.test');
  assert.equal(c.contactWhatsapp, '60123456789');
  assert.equal(c.allowedDomain, 'airasia.com');
});

test('safeNext blocks open redirects', () => {
  assert.equal(safeNext('/users?x=1'), '/users?x=1');
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/a\r\nSet-Cookie: x', null, undefined]) {
    assert.equal(safeNext(bad as string | null), '/');
  }
});

test('same-origin check', () => {
  const req = (h: Record<string, string>) => new Request('https://wf.example/users', { method: 'POST', headers: h });
  assert.equal(isSameOrigin(req({ origin: 'https://wf.example' })), true);
  assert.equal(isSameOrigin(req({ origin: 'https://evil.test' })), false);
  assert.equal(isSameOrigin(req({})), false);
});

test('rate limiter blocks after max and recovers after the window', () => {
  const rl = createRateLimiter(2, 1000);
  assert.deepEqual([rl.take('ip', 0), rl.take('ip', 1), rl.take('ip', 2)], [true, true, false]);
  assert.equal(rl.take('other', 2), true);
  assert.equal(rl.take('ip', 1001), true);
});
