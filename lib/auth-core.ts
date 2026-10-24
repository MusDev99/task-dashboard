// Minimal, dependency-free session auth (OWASP A01/A02/A07).
// Web Crypto only, so it runs unchanged on Vercel, Netlify and the Edge.
// No relative imports on purpose: tests run this file directly with `node --test`.

export const SESSION_COOKIE = 'wf_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const enc = new TextEncoder();

export interface AuthConfig {
  /** Both ADMIN_PASSWORD and AUTH_SECRET (>= 16 chars) are set. */
  configured: boolean;
  password: string;
  secret: string;
}

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig {
  const password = env.ADMIN_PASSWORD ?? '';
  const secret = env.AUTH_SECRET ?? '';
  return { configured: password.length >= 8 && secret.length >= 16, password, secret };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

/** Constant-time password check: both sides are HMAC'd first so length never leaks. */
export async function passwordMatches(input: string, expected: string, secret: string): Promise<boolean> {
  if (!expected) return false;
  const [a, b] = await Promise.all([hmac(secret, `pw:${input}`), hmac(secret, `pw:${expected}`)]);
  return timingSafeEqual(a, b);
}

/** Signed, expiring session token: `<expiryEpochSeconds>.<signature>`. Stateless, so it survives serverless cold starts. */
export async function createSessionToken(secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  return `${exp}.${toBase64Url(await hmac(secret, `session:${exp}`))}`;
}

export async function verifySessionToken(token: string | undefined, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!token || !secret) return false;
  const [expStr, sig, extra] = token.split('.');
  if (!expStr || !sig || extra !== undefined || !/^\d{1,12}$/.test(expStr)) return false;
  if (Number(expStr) * 1000 <= nowMs) return false;
  const expected = toBase64Url(await hmac(secret, `session:${expStr}`));
  return timingSafeEqual(enc.encode(sig), enc.encode(expected));
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

/** Best-effort login throttle. In-memory, so per serverless instance; add an edge/WAF rule for a hard limit. */
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
