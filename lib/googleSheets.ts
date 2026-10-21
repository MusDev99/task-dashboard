// Minimal Google Sheets v4 client. Authenticates as a service account with an
// RS256 JWT signed by node:crypto, so no Google SDK is needed.
// Imports are relative (no "@/") so scripts can run this file directly.
import { createPrivateKey, createSign } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type Cell = string | number | boolean | null;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/**
 * Accepts the many shapes a private key ends up in when pasted into a hosting UI: real newlines,
 * literal "\\n", surrounding quotes, newlines collapsed to spaces, or the whole key JSON. The PEM is
 * rebuilt from the base64 body, so only a genuinely incomplete key is rejected.
 */
function normalizeKey(raw: string, source: string): string {
  let text = raw.trim().replace(/^["']|["']$/g, "");
  if (text.startsWith("{")) {
    try {
      text = String(JSON.parse(text).private_key ?? ""); // the whole service-account JSON was pasted
    } catch {
      /* fall through to the PEM check below */
    }
  }
  text = text.replace(/\\n/g, "\n");

  const match = text.match(/-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/);
  const body = match?.[2].replace(/\s+/g, "") ?? "";
  const key = match ? `-----BEGIN ${match[1]}-----\n${(body.match(/.{1,64}/g) ?? []).join("\n")}\n-----END ${match[1]}-----\n` : text;
  try {
    createPrivateKey(key);
  } catch {
    // Describe the problem without echoing any of the secret.
    const hint = `value is ${raw.trim().length} characters; BEGIN line ${text.includes("-----BEGIN") ? "found" : "MISSING"}, END line ${text.includes("-----END") ? "found" : "MISSING"}, key body ${body.length} characters (a complete key has about 1600)`;
    throw new Error(
      `Google private key from ${source} is not valid PEM (${hint}). Paste the full "private_key" value from the service-account JSON, from -----BEGIN PRIVATE KEY----- to -----END PRIVATE KEY-----.`
    );
  }
  return key;
}

// Credentials come from the service-account JSON key at GOOGLE_SHEET_PATH, or
// (e.g. on hosts without a file system) GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.
// Fallback when GOOGLE_SHEET_PATH is unset: the first .json file in ./keys.
function findDefaultKeyPath(): string | undefined {
  try {
    const file = readdirSync(resolve("keys")).find((f) => f.endsWith(".json"));
    return file ? `./keys/${file}` : undefined;
  } catch {
    return undefined;
  }
}

function getCredentials(): { email: string; privateKey: string } {
  // GOOGLE_SHEET_PATH wins; otherwise the first ./keys/*.json; otherwise the env-var pair.
  const keyPath =
    process.env.GOOGLE_SHEET_PATH?.trim() || findDefaultKeyPath();
  if (keyPath) {
    let key;
    try {
      key = JSON.parse(readFileSync(resolve(keyPath), "utf-8"));
    } catch (e) {
      throw new Error(`Cannot read service-account key at ${resolve(keyPath)}: ${(e as Error).message}`);
    }
    if (!key.client_email || !key.private_key) {
      throw new Error(`${keyPath} is not a service-account key (missing client_email/private_key)`);
    }
    return { email: key.client_email, privateKey: normalizeKey(key.private_key, keyPath) };
  }
  return {
    email: env("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    privateKey: normalizeKey(env("GOOGLE_PRIVATE_KEY"), "GOOGLE_PRIVATE_KEY (GOOGLE_SHEET_PATH is not set)"),
  };
}

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const { email, privateKey } = getCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(privateKey);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(signature)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google auth failed (${res.status}): ${await res.text()}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

// Authenticated request with retry/backoff on rate limits (429) and 5xx.
async function sheetsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${SHEETS_API}/${env("GOOGLE_SHEET_ID")}${path}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: {
        ...init.headers,
        Authorization: `Bearer ${await getAccessToken()}`,
        "Content-Type": "application/json",
      },
    });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    throw new Error(`Sheets API ${res.status} on ${path}: ${await res.text()}`);
  }
}

// Short-lived cache + in-flight dedup so one page render (which reads the same
// tab several times) costs a single API call.
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { at: number; promise: Promise<Record<string, Cell>[]> }>();

/** Reads a tab as rows keyed by the header (first) row. */
export function readTable(tab: string): Promise<Record<string, Cell>[]> {
  const hit = cache.get(tab);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;

  const promise = sheetsFetch<{ values?: Cell[][] }>(
    `/values/${encodeURIComponent(tab)}?valueRenderOption=UNFORMATTED_VALUE`
  ).then(({ values = [] }) => {
    const [headers = [], ...rows] = values;
    return rows
      .filter((row) => row.some((c) => c !== "" && c != null))
      .map((row) =>
        Object.fromEntries(headers.map((h, i) => [String(h), row[i] === "" ? null : (row[i] ?? null)]))
      );
  });
  promise.catch(() => cache.delete(tab));
  cache.set(tab, { at: Date.now(), promise });
  return promise;
}

export function invalidateTable(tab?: string) {
  if (tab) cache.delete(tab);
  else cache.clear();
}

/** Creates the tab if missing, then replaces its contents (header + rows). */
export async function writeTable(tab: string, headers: string[], rows: Cell[][]) {
  const meta = await sheetsFetch<{ sheets: { properties: { title: string } }[] }>(
    "?fields=sheets.properties.title"
  );
  if (!meta.sheets.some((s) => s.properties.title === tab)) {
    await sheetsFetch("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    });
  }
  const range = encodeURIComponent(tab);
  await sheetsFetch(`/values/${range}:clear`, { method: "POST", body: "{}" });
  // RAW keeps ids/phone numbers/dates as typed instead of letting Sheets reinterpret them.
  await sheetsFetch(`/values/${range}!A1?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [headers, ...rows] }),
  });
  invalidateTable(tab);
}

// ─── Row-level writes ───────────────────────────────────────────────────────
// Sheets has no transactions: callers doing multi-step changes should order
// their writes so a partial failure never leaves dangling references.

const orderedRow = (headers: readonly string[], record: Record<string, Cell>): Cell[] =>
  headers.map((h) => record[h] ?? null);

// Uncached read, so row numbers always match the live sheet.
async function readRaw(tab: string): Promise<Cell[][]> {
  const { values = [] } = await sheetsFetch<{ values?: Cell[][] }>(
    `/values/${encodeURIComponent(tab)}?valueRenderOption=UNFORMATTED_VALUE`
  );
  return values;
}

/** Appends one record as a new row (columns ordered by `headers`). */
export async function appendRow(tab: string, headers: readonly string[], record: Record<string, Cell>) {
  await sheetsFetch(
    `/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: "POST", body: JSON.stringify({ values: [orderedRow(headers, record)] }) }
  );
  invalidateTable(tab);
}

/** Overwrites the row whose `id` column matches. Returns false if no such row. */
export async function updateRowById(
  tab: string,
  headers: readonly string[],
  id: string,
  record: Record<string, Cell>
): Promise<boolean> {
  return updateRowByKey(tab, headers, "id", id, record);
}

/** Overwrites the row whose `keyColumn` equals `key` (for tabs keyed by code/value instead of id). */
export async function updateRowByKey(
  tab: string,
  headers: readonly string[],
  keyColumn: string,
  key: string,
  record: Record<string, Cell>
): Promise<boolean> {
  const values = await readRaw(tab);
  const col = (values[0] ?? []).indexOf(keyColumn);
  if (col < 0) return false;
  const index = values.findIndex((row, i) => i > 0 && String(row[col]) === key);
  if (index < 0) return false;
  await sheetsFetch(`/values/${encodeURIComponent(`${tab}!A${index + 1}`)}?valueInputOption=RAW`, {
    method: "PUT",
    body: JSON.stringify({ values: [orderedRow(headers, record)] }),
  });
  invalidateTable(tab);
  return true;
}

/** Deletes every row whose `column` equals `value`. Returns how many were removed. */
export async function deleteRowsWhere(tab: string, column: string, value: string): Promise<number> {
  const values = await readRaw(tab);
  const col = (values[0] ?? []).indexOf(column);
  if (col < 0) throw new Error(`Column "${column}" not found in tab "${tab}"`);
  const rowIndexes = values.flatMap((row, i) => (i > 0 && String(row[col]) === value ? [i] : []));
  if (rowIndexes.length === 0) return 0;

  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    "?fields=sheets.properties(sheetId,title)"
  );
  const sheetId = meta.sheets.find((s) => s.properties.title === tab)?.properties.sheetId;
  if (sheetId == null) throw new Error(`Tab "${tab}" not found`);

  // Descending order so earlier deletions don't shift later indexes.
  const requests = rowIndexes
    .sort((a, b) => b - a)
    .map((i) => ({
      deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } },
    }));
  await sheetsFetch("/:batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  invalidateTable(tab);
  return rowIndexes.length;
}

// ─── Bulk helpers (roster) ──────────────────────────────────────────────────

/** Creates the tab with a header row if it doesn't exist yet. */
export async function ensureTab(tab: string, headers: readonly string[]) {
  const meta = await sheetsFetch<{ sheets: { properties: { title: string } }[] }>("?fields=sheets.properties.title");
  if (!meta.sheets.some((s) => s.properties.title === tab)) {
    await sheetsFetch("/:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: tab } } }] }),
    });
    await sheetsFetch(`/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`, {
      method: "PUT",
      body: JSON.stringify({ values: [[...headers]] }),
    });
    invalidateTable(tab);
  }
}

/** Inserts or updates many records keyed by `id` using 1 read + at most 2 writes. */
export async function upsertRowsById(tab: string, headers: readonly string[], records: Record<string, Cell>[]) {
  if (records.length === 0) return;
  const values = await readRaw(tab);
  const idCol = (values[0] ?? []).indexOf("id");
  const rowOf = new Map<string, number>();
  values.forEach((row, i) => i > 0 && rowOf.set(String(row[idCol]), i + 1));

  const updates: { range: string; values: Cell[][] }[] = [];
  const inserts: Cell[][] = [];
  for (const rec of records) {
    const row = orderedRow(headers, rec);
    const n = rowOf.get(String(rec.id));
    if (n) updates.push({ range: `${tab}!A${n}`, values: [row] });
    else inserts.push(row);
  }
  if (updates.length) {
    await sheetsFetch("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data: updates }),
    });
  }
  if (inserts.length) {
    await sheetsFetch(`/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: "POST",
      body: JSON.stringify({ values: inserts }),
    });
  }
  invalidateTable(tab);
}

/** Deletes rows whose `id` is in `ids` (single batch). Returns how many were removed. */
export async function deleteRowsByIds(tab: string, ids: string[]): Promise<number> {
  return deleteRowsMatching(tab, "id", new Set(ids));
}

/** Deletes rows whose `column` value is in `values` (single batch). */
export async function deleteRowsMatching(tab: string, column: string, wanted: Set<string>): Promise<number> {
  if (wanted.size === 0) return 0;
  const values = await readRaw(tab);
  const col = (values[0] ?? []).indexOf(column);
  if (col < 0) throw new Error(`Column "${column}" not found in tab "${tab}"`);
  const rowIndexes = values.flatMap((row, i) => (i > 0 && wanted.has(String(row[col])) ? [i] : []));
  if (rowIndexes.length === 0) return 0;

  const meta = await sheetsFetch<{ sheets: { properties: { sheetId: number; title: string } }[] }>(
    "?fields=sheets.properties(sheetId,title)"
  );
  const sheetId = meta.sheets.find((s) => s.properties.title === tab)?.properties.sheetId;
  if (sheetId == null) throw new Error(`Tab "${tab}" not found`);

  const requests = rowIndexes
    .sort((a, b) => b - a)
    .map((i) => ({ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: i, endIndex: i + 1 } } }));
  await sheetsFetch("/:batchUpdate", { method: "POST", body: JSON.stringify({ requests }) });
  invalidateTable(tab);
  return rowIndexes.length;
}
