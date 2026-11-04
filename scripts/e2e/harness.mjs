// Shared bits of the browser e2e scripts: a production server wired to the fake Google + in-memory data store
// (fake-google.cjs), a sign-in helper that skips Google, and small assertion helpers.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');

const KL_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
/** A date n days from today in the organisation's time zone (Asia/Kuala_Lumpur, the default), as YYYY-MM-DD. */
export const dayPlus = (n) => { const [y, m, d] = KL_TODAY.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };

export const USER_HEAD = ['id', 'email', 'name', 'employeeId', 'googleId', 'isActive', 'joinedDate', 'updatedAt', 'phoneNumber', 'roleId', 'avatar', 'locationId', 'access'];
export const person = (id, email, name, access) => [id, email, name, '', '', true, '2026-01-01 00:00:00.000', '2026-01-01 00:00:00.000', '', '', '', '', access];

/** people: [[id, email, name, access]...]; seed: { tab: [[header], [row]...] } for other tabs. */
export async function startHarness({ prefix, port, people, seed = {} }) {
  const BASE = `http://localhost:${port}`;
  const dir = mkdtempSync(join(tmpdir(), `${prefix}-`));
  writeFileSync(join(dir, 'users.json'), JSON.stringify({ values: [USER_HEAD, ...people.map((p) => person(...p))] }));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(seed));

  const tabs = () => JSON.parse(readFileSync(join(dir, 'tabs.json'), 'utf8'));
  /** A tab as objects keyed by its header (always the live data the app has stored). */
  const table = (name) => { const [h = [], ...rows] = tabs()[name] ?? []; return rows.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]]))); };

  const plus = dayPlus;

  const pem = execFileSync('openssl', ['genrsa', '2048'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const server = spawn('npx', ['next', 'start', '-p', String(port)], {
    cwd: root,
    env: {
      ...process.env, NODE_OPTIONS: `--require ${join(root, 'scripts/e2e/fake-google.cjs')}`, FAKE_DIR: dir,
      DATA_STORE_ID: 'store', DATA_STORE_CLIENT_EMAIL: 'svc@example.iam.example.com', DATA_STORE_PRIVATE_KEY: pem,
      AUTH_SECRET: 'e2e-secret-e2e-secret', GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'csecret', APP_URL: BASE,
    },
    stdio: process.env.E2E_DEBUG ? 'inherit' : 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/login`)).ok) break; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }

  const results = [];
  const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`); };
  const until = async (fn, ms = 10000) => { const end = Date.now() + ms; while (Date.now() < end) { if (fn()) return true; await new Promise((r) => setTimeout(r, 150)); } return fn(); };

  /** Signs in as `email` (the fake Google vouches for them) and lands on `next`. Starts the flow directly, with one retry. */
  async function signIn(browser, email, viewport = { width: 1280, height: 800 }, next = '/leave') {
    writeFileSync(join(dir, 'identity.json'), JSON.stringify({ sub: `sub-${email}`, email }));
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    await page.route(/\/api\/auth\/google(\?|$)/, async (route) => {
      const res = await route.fetch({ maxRedirects: 0 });
      const to = new URL(res.headers()['location']);
      if (to.origin !== 'https://accounts.google.com') return route.fulfill({ response: res });
      writeFileSync(join(dir, 'nonce.txt'), to.searchParams.get('nonce'));
      await route.fulfill({ response: res, status: 302, headers: { ...res.headers(), location: `${to.searchParams.get('redirect_uri')}?code=abc&state=${to.searchParams.get('state')}` } });
    });
    for (let attempt = 0; attempt < 3 && page.url() !== `${BASE}${next}`; attempt++) {
      await page.goto(`${BASE}/api/auth/google?next=${encodeURIComponent(next)}`, { waitUntil: 'load' }).catch(() => {});
    }
    if (page.url() !== `${BASE}${next}`) {
      console.log(`sign-in as ${email} stuck at ${page.url()}`);
      throw new Error(`sign-in failed for ${email}`);
    }
    return { ctx, page };
  }

  const stop = () => { try { process.kill(-server.pid); } catch { /* already gone */ } };
  const finish = (label) => {
    const failed = results.filter((r) => !r).length;
    console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} ${label} e2e checks passed (screenshots in ${dir})`);
    process.exit(failed ? 1 : 0);
  };
  return { dir, BASE, table, plus, signIn, check, until, stop, finish };
}
