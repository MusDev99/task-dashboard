// Test-only preload (node --require): stands in for Google's token/JWKS endpoints and the Sheets API so the
// SSO flow can be exercised end to end without credentials. State is exchanged through files in $FAKE_DIR:
//   identity.json {sub,email}  who the fake Google authenticates   nonce.txt  nonce captured at "authorize"
//   users.json {values:[[...]]}  the users tab                     down  (file exists) = Sheets returns 403
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

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
  if (url.host === 'oauth2.googleapis.com' && url.pathname === '/token') {
    const form = new URLSearchParams(String(init.body));
    if (form.get('grant_type') === 'authorization_code') {
      if (!form.get('code_verifier') || form.get('client_secret') !== process.env.GOOGLE_CLIENT_SECRET) return json({ error: 'invalid_grant' }, 400);
      return json({ id_token: mintIdToken(), access_token: 'user-token', expires_in: 3600 });
    }
    return json({ access_token: 'service-token', expires_in: 3600 }); // service-account JWT grant for Sheets
  }
  if (url.host === 'www.googleapis.com' && url.pathname === '/oauth2/v3/certs') return json({ keys: [jwk] });
  if (url.host === 'sheets.googleapis.com') {
    if (fs.existsSync(file('down'))) return json({ error: { message: 'forbidden' } }, 403);
    const m = decodeURIComponent(url.pathname).match(/\/values\/([^!:/]+)(?:!A(\d+))?/);
    const tab = m && m[1];
    if (tab !== 'users') return json({ error: { message: `Unable to parse range: ${tab}` } }, 400);
    const data = JSON.parse(fs.readFileSync(file('users.json'), 'utf8'));
    if ((init.method ?? 'GET') === 'PUT') {
      data.values[Number(m[2]) - 1] = JSON.parse(init.body).values[0];
      fs.writeFileSync(file('users.json'), JSON.stringify(data));
      return json({ updatedRows: 1 });
    }
    return json(data);
  }
  return realFetch(input, init);
};
