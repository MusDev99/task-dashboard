import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRateLimiter,
  createSessionToken,
  isSameOrigin,
  passwordMatches,
  readAuthConfig,
  safeNext,
  verifySessionToken,
} from '../lib/auth-core.ts';

const SECRET = 'x'.repeat(32);

test('session token verifies, expires and rejects tampering', async () => {
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const token = await createSessionToken(SECRET, t0);
  assert.equal(await verifySessionToken(token, SECRET, t0 + 1000), true);
  assert.equal(await verifySessionToken(token, SECRET, t0 + 9 * 3600 * 1000), false, 'expired');
  assert.equal(await verifySessionToken(token, 'y'.repeat(32), t0 + 1000), false, 'wrong secret');
  const [exp, sig] = token.split('.');
  assert.equal(await verifySessionToken(`${Number(exp) + 99999}.${sig}`, SECRET, t0), false, 'extended expiry');
  for (const bad of ['', 'a', 'a.b.c', '123.', '.sig', undefined]) assert.equal(await verifySessionToken(bad, SECRET, t0), false);
});

test('password check is exact and never throws on odd input', async () => {
  assert.equal(await passwordMatches('correct horse', 'correct horse', SECRET), true);
  assert.equal(await passwordMatches('correct horsf', 'correct horse', SECRET), false);
  assert.equal(await passwordMatches('', 'correct horse', SECRET), false);
  assert.equal(await passwordMatches('anything', '', SECRET), false, 'unset password never matches');
});

test('auth config needs a real password and secret', () => {
  assert.equal(readAuthConfig({}).configured, false);
  assert.equal(readAuthConfig({ ADMIN_PASSWORD: 'short', AUTH_SECRET: SECRET }).configured, false);
  assert.equal(readAuthConfig({ ADMIN_PASSWORD: 'long enough pw', AUTH_SECRET: 'tiny' }).configured, false);
  assert.equal(readAuthConfig({ ADMIN_PASSWORD: 'long enough pw', AUTH_SECRET: SECRET }).configured, true);
});

test('safeNext blocks open redirects', () => {
  assert.equal(safeNext('/japan/tokyo?x=1'), '/japan/tokyo?x=1');
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/a\r\nSet-Cookie: x', null, undefined]) {
    assert.equal(safeNext(bad as string | null), '/');
  }
});

test('same-origin check for CSRF', () => {
  const req = (h: Record<string, string>) => new Request('https://wf.example/users', { method: 'POST', headers: h });
  assert.equal(isSameOrigin(req({ origin: 'https://wf.example' })), true);
  assert.equal(isSameOrigin(req({ origin: 'https://evil.test' })), false);
  assert.equal(isSameOrigin(req({})), false, 'no Origin and no Fetch-Metadata is rejected');
  assert.equal(isSameOrigin(req({ 'sec-fetch-site': 'cross-site', origin: 'https://wf.example' })), false);
});

test('rate limiter blocks after max and recovers after the window', () => {
  const rl = createRateLimiter(2, 1000);
  assert.deepEqual([rl.take('ip', 0), rl.take('ip', 1), rl.take('ip', 2)], [true, true, false]);
  assert.equal(rl.take('other', 2), true);
  assert.equal(rl.take('ip', 1001), true);
});
