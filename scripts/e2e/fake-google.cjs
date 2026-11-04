// Test-only preload (node --require): stands in for Google's token/JWKS endpoints and the data-store API so the
// SSO flow can be exercised end to end without credentials. State is exchanged through files in $FAKE_DIR:
//   identity.json {sub,email}  who the fake Google authenticates   nonce.txt  nonce captured at "authorize"
//   users.json {values:[[...]]}  the users table                       down  (file exists) = data store returns 403
//   seed.json {tab:[[...]]}  other tabs to start with                  tabs.json  every tab after each write (for assertions)
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dir = process.env.FAKE_DIR;
const file = (n) => path.join(dir, n);
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'fake-1', alg: 'RS256', use: 'sig' };
const b64u = (x) => Buffer.from(x).toString('base64url');

function mintIdToken() {
  const id = JSON.parse(fs.readFileSync(file('identity.json'), 'utf8'));
  const nonce = fs.existsSync(file('nonce.txt')) ? fs.readFileSync(file('nonce.txt'), 'utf8') : '';
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'fake-1' }));
  const body = b64u(JSON.stringify({
    iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 600,
    nonce: id.badNonce ? 'wrong' : nonce, sub: id.sub, email: id.email, email_verified: true, name: id.email,
  }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64u(sig)}`;
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
const realFetch = globalThis.fetch;

// In-memory data store: every tab is an array of rows (row 1 = header). `users` stays file-backed (users.json), so the
// SSO e2e can still seed it and read back the bound googleId. All tabs are mirrored to tabs.json after each write so a
// test can inspect what the app stored. A tab that was never created answers 400 "Unable to parse range", like the real API.
const tabs = new Map();
const created = [];
const loadTab = (t) => (t === 'users' ? JSON.parse(fs.readFileSync(file('users.json'), 'utf8')).values : tabs.get(t));
const saveTab = (t, values) => {
  if (t === 'users') fs.writeFileSync(file('users.json'), JSON.stringify({ values }));
  else tabs.set(t, values);
  fs.writeFileSync(file('tabs.json'), JSON.stringify(Object.fromEntries([...tabs, ['users', loadTab('users')]])));
};
const sheetId = (t) => (t === 'users' ? 0 : 1 + created.indexOf(t));
const put = (t, startRow, rows) => {
  const values = loadTab(t) ?? [];
  rows.forEach((r, i) => { values[startRow - 1 + i] = r; });
  saveTab(t, values);
};

// Optional seed: $FAKE_DIR/seed.json {tab: [[header], [row]...]} for tabs other than users.
if (fs.existsSync(file('seed.json'))) {
  for (const [t, v] of Object.entries(JSON.parse(fs.readFileSync(file('seed.json'), 'utf8')))) { tabs.set(t, v); created.push(t); }
}

function fakeStore(url, init) {
  const method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(String(init.body)) : {};
  const p = decodeURIComponent(url.pathname).replace(/^.*\/spreadsheets\/[^/]+/, '');
  if (p === '/:batchUpdate') {
    for (const r of body.requests) {
      if (r.addSheet) { const t = r.addSheet.properties.title; if (!tabs.has(t) && t !== 'users') { created.push(t); saveTab(t, []); } }
      if (r.deleteDimension) {
        const { sheetId: id, startIndex, endIndex } = r.deleteDimension.range;
        const t = id === 0 ? 'users' : created[id - 1];
        const values = loadTab(t); values.splice(startIndex, endIndex - startIndex); saveTab(t, values);
      }
    }
    return json({});
  }
  if (p === '/values:batchUpdate') {
    for (const d of body.data) { const m = d.range.match(/^([^!]+)!A(\d+)/); put(m[1], Number(m[2]), d.values); }
    return json({});
  }
  const m = p.match(/^\/values\/([^!:/]+)(?:!A(\d+))?(:append|:clear)?$/);
  if (!m) return json({ sheets: ['users', ...created].map((t) => ({ properties: { title: t, sheetId: sheetId(t) } })) });
  const [, tab, row, op] = m;
  const values = loadTab(tab);
  if (!values) return json({ error: { message: `Unable to parse range: ${tab}` } }, 400);
  if (op === ':clear') { saveTab(tab, []); return json({}); }
  if (op === ':append') { saveTab(tab, [...values, ...body.values]); return json({}); }
  if (method === 'PUT') { put(tab, Number(row), body.values); return json({ updatedRows: body.values.length }); }
  return json({ values });
}

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token') {
    const form = new URLSearchParams(String(init.body));
    if (form.get('grant_type') === 'authorization_code') {
      if (!form.get('code_verifier') || form.get('client_secret') !== process.env.GOOGLE_CLIENT_SECRET) return json({ error: 'invalid_grant' }, 400);
      return json({ id_token: mintIdToken(), access_token: 'user-token', expires_in: 3600 });
    }
    return json({ access_token: 'service-token', expires_in: 3600 }); // service-account JWT grant for the data store
  }
  if (url.host === 'www.googleapis.com' && url.pathname === '/oauth2/v3/certs') return json({ keys: [jwk] });
  // Anything else on *.googleapis.com is the data-store API (its host is configured inside lib/store.ts).
  if (url.host.endsWith('.googleapis.com') && url.host !== 'oauth2.googleapis.com' && url.host !== 'www.googleapis.com') {
    if (fs.existsSync(file('down'))) return json({ error: { message: 'forbidden' } }, 403);
    return fakeStore(url, init);
  }
  return realFetch(input, init);
};
