#!/usr/bin/env node
// End-to-end check of the Google SSO flow against a production build, with fake Google + fake Sheets
// (scripts/e2e/fake-google.cjs). Needs `npm run build` first and Playwright (preinstalled in Claude Code
// cloud sessions; elsewhere: `npm i -D playwright`). Run: node scripts/e2e/sso.e2e.mjs
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = 4398;
const BASE = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), 'sso-e2e-'));
const root = resolve(import.meta.dirname, '../..');

const HEAD = ['id', 'email', 'name', 'employeeId', 'googleId', 'isActive', 'joinedDate', 'updatedAt', 'phoneNumber', 'roleId', 'avatar', 'locationId'];
const row = (id, email, name, googleId, active) => [id, email, name, '', googleId, active, '2026-01-01 00:00:00.000', '2026-01-01 00:00:00.000', '', '', '', ''];
const writeUsers = () =>
  writeFileSync(join(dir, 'users.json'), JSON.stringify({ values: [HEAD, row('u-ann', 'Ann@AirAsia.com', 'Ann Lee -', '', true), row('u-cat', 'cat@airasia.com', 'Cat', '', false)] }));
const setIdentity = (id) => writeFileSync(join(dir, 'identity.json'), JSON.stringify(id));
writeUsers();

const pem = execFileSync('openssl', ['genrsa', '2048'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: root,
  env: {
    ...process.env, NODE_OPTIONS: `--require ${join(root, 'scripts/e2e/fake-google.cjs')}`, FAKE_DIR: dir,
    GOOGLE_SHEET_ID: 'sheet', GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@x.iam.gserviceaccount.com', GOOGLE_PRIVATE_KEY: pem,
    AUTH_SECRET: 'e2e-secret-e2e-secret', GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'csecret',
    APP_URL: BASE, CONTACT_WHATSAPP: '+60 12-345 6789',
  },
  stdio: process.env.E2E_DEBUG ? 'inherit' : 'ignore',
  detached: true, // own process group, so the whole next server tree is stopped at the end
});
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(`${BASE}/login`)).ok) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`); };

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  // Stand in for accounts.google.com. Chromium doesn't expose redirect hops to route(), so intercept our own
  // /api/auth/google response: check it points at Google, remember the nonce, bounce straight back with a code.
  await page.route(/\/api\/auth\/google(\?|$)/, async (route) => {
    const res = await route.fetch({ maxRedirects: 0 });
    const to = new URL(res.headers()['location']);
    if (to.origin !== 'https://accounts.google.com') return route.fulfill({ response: res });
    writeFileSync(join(dir, 'nonce.txt'), to.searchParams.get('nonce'));
    const back = `${to.searchParams.get('redirect_uri')}?code=abc&state=${to.searchParams.get('state')}`;
    await route.fulfill({ response: res, status: 302, headers: { ...res.headers(), location: back } });
  });
  return { ctx, page };
}
const sessionCookie = async (ctx) => (await ctx.cookies()).find((c) => c.name === 'wf_session');

const browser = await chromium.launch();
try {
  // 1. registered user lands on the page they asked for
  for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile 375px', { width: 375, height: 740 }]]) {
    writeUsers(); // fresh, unbound row
    setIdentity({ sub: 'sub-ann', email: 'ann@airasia.com' });
    const { ctx, page } = await newPage(browser, vp);
    await page.goto(`${BASE}/users`);
    check(`[${label}] signed-out /users goes to /login`, page.url().includes('/login?next=%2Fusers'), page.url());
    await page.click('text=Sign in with Google');
    await page.waitForURL(`${BASE}/users`, { timeout: 15000 }).catch(() => console.log('stuck at', page.url()));
    const c = await sessionCookie(ctx);
    check(`[${label}] registered user is signed in and returned to /users`, !!c && c.httpOnly && c.sameSite === 'Lax');
    const bound = JSON.parse(readFileSync(join(dir, 'users.json'), 'utf8')).values[1][4];
    check(`[${label}] googleId is bound to the row on first sign-in`, bound === 'sub-ann', String(bound));
    check(`[${label}] sidebar shows the signed-in name`, (await page.locator('.sidebar-user-name').first().textContent({ timeout: 5000 }).catch(() => ''))?.includes('Ann Lee') ?? false);
    await ctx.close();
  }

  // 2. unknown email → banner with WhatsApp link, no session
  setIdentity({ sub: 'sub-nobody', email: 'nobody@example.com' });
  {
    const { ctx, page } = await newPage(browser, { width: 375, height: 740 });
    await page.goto(`${BASE}/login`);
    await page.click('text=Sign in with Google');
    await page.waitForURL(/\/login\?e=not_registered/, { timeout: 15000 });
    const banner = await page.locator('.login-refused').textContent();
    check('unknown email: banner names the account', banner.includes('nobody@example.com') && banner.includes('isn\'t registered'));
    const href = await page.locator('a.login-contact').getAttribute('href');
    check('unknown email: WhatsApp link is wa.me/<digits> with the email prefilled', href.startsWith('https://wa.me/60123456789?text=') && decodeURIComponent(href).includes('nobody@example.com'), href);
    check('unknown email: no session cookie', !(await sessionCookie(ctx)));
    check('unknown email: no horizontal scroll at 375px', !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
    await page.screenshot({ path: join(dir, 'not-registered-375.png') });
    await page.goto(`${BASE}/users`);
    check('unknown email: still gated afterwards', page.url().includes('/login'));
    await ctx.close();
  }

  // 3. deactivated user
  setIdentity({ sub: 'sub-cat', email: 'cat@airasia.com' });
  {
    const { ctx, page } = await newPage(browser, { width: 1280, height: 800 });
    await page.goto(`${BASE}/login`);
    await page.click('text=Sign in with Google');
    await page.waitForURL(/\/login\?e=inactive/, { timeout: 15000 });
    check('deactivated user: banner + no session', (await page.locator('.login-refused').textContent()).includes('deactivated') && !(await sessionCookie(ctx)));
    await ctx.close();
  }

  // 4. attacks / failures
  setIdentity({ sub: 'sub-ann', email: 'ann@airasia.com', badNonce: true });
  {
    const { ctx, page } = await newPage(browser, { width: 1280, height: 800 });
    await page.goto(`${BASE}/login`);
    await page.click('text=Sign in with Google');
    await page.waitForURL(/\/login\?e=error/, { timeout: 15000 });
    check('replayed/wrong nonce is rejected', !(await sessionCookie(ctx)));
    const r = await fetch(`${BASE}/api/auth/google/callback?code=abc&state=forged`, { redirect: 'manual' });
    check('callback with no/forged state is rejected', (r.headers.get('location') ?? '').includes('e=error'), r.headers.get('location') ?? '');
    const start = await fetch(`${BASE}/api/auth/google?next=https://evil.test`, { redirect: 'manual' });
    check('start redirects to Google with PKCE + state', (start.headers.get('location') ?? '').startsWith('https://accounts.google.com/') && (start.headers.get('location') ?? '').includes('code_challenge_method=S256'));
    await ctx.close();
  }

  // 5. Sheets outage must not read as "not registered" (the tab read is cached for 15s)
  await new Promise((r) => setTimeout(r, 16000));
  writeFileSync(join(dir, 'down'), '1');
  setIdentity({ sub: 'sub-ann', email: 'ann@airasia.com' });
  {
    const { ctx, page } = await newPage(browser, { width: 1280, height: 800 });
    await page.goto(`${BASE}/login`);
    await page.click('text=Sign in with Google');
    await page.waitForURL(/\/login\?e=unavailable/, { timeout: 20000 });
    check('Sheets outage shows "unavailable", not "not registered"', !(await page.locator('.login-refused').count()) && !(await sessionCookie(ctx)));
    await ctx.close();
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already gone */ }
}
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} SSO e2e checks passed (screenshot: ${join(dir, 'not-registered-375.png')})`);
process.exit(failed ? 1 : 0);
