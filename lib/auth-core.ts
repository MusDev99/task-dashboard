// Dependency-free session primitives (OWASP A01/A02/A07).
// Web Crypto only, so it runs unchanged on Netlify, Vercel and the Edge.
// No relative imports on purpose: tests run this file directly with `node --test`.

export const SESSION_COOKIE = 'wf_session';
export const OAUTH_COOKIE = 'wf_oauth'; // state + nonce + PKCE verifier while the person is at Google
export const FLASH_COOKIE = 'wf_flash'; // why sign-in was refused, for the banner on /login
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours
export const OAUTH_TTL_SECONDS = 60 * 10;
export const FLASH_TTL_SECONDS = 60 * 5;

const enc = new TextEncoder();
const dec = new TextDecoder();

export interface SessionUser {
  /** Row id in the `users` tab. */
  uid: string;
  email: string;
}

export interface AuthConfig {
  /** AUTH_SECRET (>= 16 chars) and the Google client id + secret are all set. */
  configured: boolean;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
  /** Public origin (no trailing slash); the OAuth redirect URI is `${appUrl}/api/auth/google/callback`. */
  appUrl: string;
  /** Optional Google Workspace domain the account must belong to (extra guard on top of the users tab). */
  allowedDomain: string;
  /** Digits only, country code included (for the wa.me link). */
  contactWhatsapp: string;
}

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const secret = env.AUTH_SECRET ?? '';
  const googleClientId = env.GOOGLE_CLIENT_ID ?? '';
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET ?? '';
  return {
    configured: secret.length >= 16 && googleClientId.length > 0 && googleClientSecret.length > 0,
    secret,
    googleClientId,
    googleClientSecret,
    appUrl: (env.APP_URL ?? '').trim().replace(/\/+$/, ''),
    allowedDomain: (env.GOOGLE_ALLOWED_DOMAIN ?? '').trim().toLowerCase(),
    contactWhatsapp: (env.CONTACT_WHATSAPP ?? '').replace(/\D/g, ''),
  };
}

/**
 * Why `configured` is false, by variable name only (never a value). Shown on /login in development so a
 * missing or mistyped variable is obvious; production never shows it.
 */
export function authConfigProblems(env: Record<string, string | undefined> = process.env): string[] {
  const out: string[] = [];
  const secret = env.AUTH_SECRET ?? '';
  if (!secret) out.push('AUTH_SECRET is missing or empty');
  else if (secret.length < 16) out.push(`AUTH_SECRET is too short (${secret.length} characters, needs at least 16)`);
  if (!env.GOOGLE_CLIENT_ID) out.push('GOOGLE_CLIENT_ID is missing or empty');
  if (!env.GOOGLE_CLIENT_SECRET) out.push('GOOGLE_CLIENT_SECRET is missing or empty');
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

type Typ = 's' | 'o' | 'f';

/** `<base64url(json)>.<hmac>`; `typ` is signed too, so a flash cookie can never be replayed as a session. */
async function sign(secret: string, typ: Typ, body: Record<string, unknown>, ttlSeconds: number, nowMs: number): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = toBase64Url(enc.encode(JSON.stringify({ ...body, typ, exp })));
  return `${payload}.${toBase64Url(await hmac(secret, `v2:${payload}`))}`;
}

async function verify(token: string | undefined, secret: string, typ: Typ, nowMs: number): Promise<Record<string, unknown> | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    const expected = toBase64Url(await hmac(secret, `v2:${parts[0]}`));
    if (!timingSafeEqual(enc.encode(parts[1]), enc.encode(expected))) return null;
    const body = JSON.parse(dec.decode(fromBase64Url(parts[0]))) as Record<string, unknown>;
    if (body.typ !== typ || typeof body.exp !== 'number' || body.exp * 1000 <= nowMs) return null;
    return body;
  } catch {
    return null;
  }
}

export async function createSessionToken(secret: string, user: SessionUser, nowMs = Date.now()): Promise<string> {
  return sign(secret, 's', { uid: user.uid, email: user.email }, SESSION_TTL_SECONDS, nowMs);
}

/** The signed-in person, or null for a missing, expired, tampered or wrong-type token. */
export async function verifySessionToken(token: string | undefined, secret: string, nowMs = Date.now()): Promise<SessionUser | null> {
  const body = await verify(token, secret, 's', nowMs);
  return body && typeof body.uid === 'string' && typeof body.email === 'string' ? { uid: body.uid, email: body.email } : null;
}

export interface OAuthState {
  state: string;
  nonce: string;
  verifier: string;
  next: string;
}

export const createOAuthCookie = (secret: string, s: OAuthState, nowMs = Date.now()) =>
  sign(secret, 'o', { ...s }, OAUTH_TTL_SECONDS, nowMs);

export async function readOAuthCookie(token: string | undefined, secret: string, nowMs = Date.now()): Promise<OAuthState | null> {
  const b = await verify(token, secret, 'o', nowMs);
  return b && typeof b.state === 'string' && typeof b.nonce === 'string' && typeof b.verifier === 'string' && typeof b.next === 'string'
    ? { state: b.state, nonce: b.nonce, verifier: b.verifier, next: b.next }
    : null;
}

export type FlashReason = 'not_registered' | 'inactive';
export interface Flash {
  reason: FlashReason;
  email: string;
}

export const createFlashCookie = (secret: string, f: Flash, nowMs = Date.now()) =>
  sign(secret, 'f', { ...f }, FLASH_TTL_SECONDS, nowMs);

export async function readFlashCookie(token: string | undefined, secret: string, nowMs = Date.now()): Promise<Flash | null> {
  const b = await verify(token, secret, 'f', nowMs);
  return b && (b.reason === 'not_registered' || b.reason === 'inactive') && typeof b.email === 'string'
    ? { reason: b.reason, email: b.email }
    : null;
}

/** Only same-site relative paths are allowed after login (prevents open redirects, A01). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\') || /[\r\n]/.test(next)) return fallback;
  return next;
}

/** CSRF defence for cookie-authenticated writes: Origin (or Sec-Fetch-Site) must match this site. */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'none';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/** Best-effort throttle. In-memory, so per serverless instance; add an edge/WAF rule for a hard limit. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key: string, now = Date.now()): boolean {
      const cur = hits.get(key);
      if (!cur || cur.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        if (hits.size > 5000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        return true;
      }
      cur.count += 1;
      return cur.count <= max;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}

export function clientIp(request: Request): string {
  return (request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown').trim();
}
