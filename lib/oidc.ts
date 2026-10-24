// Google OpenID Connect (authorization code + PKCE) primitives. Web Crypto only, no relative imports,
// so `node --test` can run them. Network calls live in the route handlers, not here.

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface Endpoints {
  auth: string;
  token: string;
  jwks: string;
  issuers: string[];
}

const GOOGLE: Endpoints = {
  auth: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
  jwks: 'https://www.googleapis.com/oauth2/v3/certs',
  issuers: ['https://accounts.google.com', 'accounts.google.com'],
};

/** Fixed Google hosts only (OWASP A10): nothing here is configurable from env or from the request. */
export const googleEndpoints: Endpoints = GOOGLE;

const b64u = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (text: string) => {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export const randomToken = (bytes = 32) => b64u(crypto.getRandomValues(new Uint8Array(bytes)));

/** RFC 7636 S256 challenge. */
export async function pkceChallenge(verifier: string): Promise<string> {
  return b64u(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(verifier))));
}

export function buildAuthUrl(
  ep: Endpoints,
  p: { clientId: string; redirectUri: string; state: string; nonce: string; challenge: string; hd?: string }
): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  if (p.hd) q.set('hd', p.hd); // UX hint only; the callback re-checks the `hd` claim
  return `${ep.auth}?${q}`;
}

export interface Jwks {
  keys: Array<JsonWebKey & { kid?: string }>;
}

export interface IdClaims {
  sub: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  picture?: string;
  hd?: string;
}

export type IdTokenResult = { ok: true; claims: IdClaims } | { ok: false; reason: string };

/** Verifies signature (RS256 via JWKS) and iss / aud / exp / nonce / email_verified / optional hd. */
export async function verifyIdToken(
  token: string,
  jwks: Jwks,
  expect: { audience: string; nonce: string; issuers: string[]; allowedDomain?: string; nowMs?: number }
): Promise<IdTokenResult> {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  try {
    const header = JSON.parse(dec.decode(unb64u(parts[0]))) as { alg?: string; kid?: string };
    if (header.alg !== 'RS256') return { ok: false, reason: 'alg' };
    const jwk = jwks.keys.find((k) => k.kid === header.kid);
    if (!jwk) return { ok: false, reason: 'kid' };
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
    if (!valid) return { ok: false, reason: 'signature' };

    const c = JSON.parse(dec.decode(unb64u(parts[1]))) as Record<string, unknown>;
    const now = Math.floor((expect.nowMs ?? Date.now()) / 1000);
    if (typeof c.iss !== 'string' || !expect.issuers.includes(c.iss)) return { ok: false, reason: 'iss' };
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (!aud.includes(expect.audience)) return { ok: false, reason: 'aud' };
    if (typeof c.exp !== 'number' || c.exp <= now) return { ok: false, reason: 'exp' };
    if (c.nonce !== expect.nonce) return { ok: false, reason: 'nonce' };
    if (typeof c.sub !== 'string' || typeof c.email !== 'string') return { ok: false, reason: 'claims' };
    if (c.email_verified !== true && c.email_verified !== 'true') return { ok: false, reason: 'email_unverified' };
    if (expect.allowedDomain && String(c.hd ?? '').toLowerCase() !== expect.allowedDomain) return { ok: false, reason: 'domain' };
    return { ok: true, claims: c as unknown as IdClaims };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
