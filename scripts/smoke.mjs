#!/usr/bin/env node
// Post-deploy smoke test: node scripts/smoke.mjs https://your-site.example
// Proves the OWASP A01/A05 basics on a live deployment: nothing is readable or writable without a session.
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok, detail });
const req = (path, init = {}) => fetch(base + path, { redirect: 'manual', ...init });

const gated = (r) => (r.status >= 300 && r.status < 400 && (r.headers.get('location') ?? '').includes('/login')) || r.status === 503;

for (const path of ['/', '/users', '/roster', '/tasks', '/settings', '/teams']) {
  const r = await req(path);
  check(`GET ${path} without session is gated`, gated(r), `HTTP ${r.status}`);
}
const action = await req('/users', { method: 'POST', headers: { 'next-action': 'smoke', 'content-type': 'text/plain' }, body: '[]' });
check('server action without session is refused', action.status === 401 || action.status === 503, `HTTP ${action.status}`);

const start = await req('/api/auth/google');
const startTo = start.headers.get('location') ?? '';
check('Google sign-in starts (302 to accounts.google.com, or /login?e=unconfigured)', start.status === 302 && (startTo.startsWith('https://accounts.google.com/') || startTo.includes('/login?e=unconfigured')), `HTTP ${start.status}`);

const login = await req('/login');
check('/login is reachable', login.status === 200, `HTTP ${login.status}`);
for (const h of ['x-content-type-options', 'x-frame-options', 'referrer-policy', 'content-security-policy']) {
  check(`header ${h}`, login.headers.has(h), login.headers.get(h) ? 'ok' : 'missing');
}
if (base.startsWith('https://')) check('header strict-transport-security', login.headers.has('strict-transport-security'));
check('X-Powered-By is hidden', !login.headers.has('x-powered-by'));

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll smoke checks passed');
process.exit(failed ? 1 : 0);
