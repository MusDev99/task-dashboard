import { NextResponse, type NextRequest } from "next/server";
import {
  FLASH_COOKIE, FLASH_TTL_SECONDS, OAUTH_COOKIE, SESSION_COOKIE, SESSION_TTL_SECONDS,
  clientIp, createFlashCookie, createRateLimiter, createSessionToken, readAuthConfig, readOAuthCookie, safeNext,
  type Flash,
} from "../../../../../lib/auth-core";
import { googleEndpoints, verifyIdToken, type Jwks } from "../../../../../lib/oidc";
import { matchUser } from "../../../../../lib/registration";
import { readUsers } from "../../../../../lib/actions";
import { updateRowById } from "../../../../../lib/store";
import { USER_COLUMNS } from "../../../../../lib/schema";

export const dynamic = "force-dynamic";

const g = globalThis as { __oauthCbLimiter?: ReturnType<typeof createRateLimiter>; __jwks?: { at: number; keys: Jwks } };
const limiter = (g.__oauthCbLimiter ??= createRateLimiter(20, 10 * 60 * 1000));

async function loadJwks(url: string): Promise<Jwks> {
  if (g.__jwks && Date.now() - g.__jwks.at < 60 * 60 * 1000) return g.__jwks.keys;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const keys = (await res.json()) as Jwks;
  g.__jwks = { at: Date.now(), keys };
  return keys;
}

/** Step 2: Google sends the person back here with a one-time code. */
export async function GET(req: NextRequest) {
  const cfg = readAuthConfig();
  const production = process.env.NODE_ENV === "production";
  const base = cfg.appUrl || req.nextUrl.origin;

  const finish = (res: NextResponse) => {
    res.cookies.set(OAUTH_COOKIE, "", { path: "/api/auth", maxAge: 0 }); // one-time use
    return res;
  };
  const to = (code: string) => finish(NextResponse.redirect(new URL(`/login?e=${code}`, base), 302));

  if (!cfg.configured) return to("unconfigured");
  if (!limiter.take(clientIp(req))) return to("throttled");

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return to("denied"); // e.g. the person pressed Cancel at Google
  const code = q.get("code");
  const saved = await readOAuthCookie(req.cookies.get(OAUTH_COOKIE)?.value, cfg.secret);
  if (!code || !saved || saved.state !== q.get("state")) {
    console.warn("oauth: callback rejected:", !code ? "no code" : !saved ? "missing or expired oauth cookie" : "state mismatch");
    return to("error");
  }

  const ep = googleEndpoints;
  let claims;
  try {
    const tokenRes = await fetch(ep.token, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: cfg.googleClientId,
        client_secret: cfg.googleClientSecret,
        redirect_uri: `${base}/api/auth/google/callback`,
        code_verifier: saved.verifier,
      }),
      cache: "no-store",
    });
    if (!tokenRes.ok) {
      console.error("oauth: token exchange failed", tokenRes.status);
      return to("error");
    }
    const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
    if (!idToken) return to("error");
    const verified = await verifyIdToken(idToken, await loadJwks(ep.jwks), {
      audience: cfg.googleClientId,
      nonce: saved.nonce,
      issuers: ep.issuers,
      allowedDomain: cfg.allowedDomain || undefined,
    });
    if (!verified.ok) {
      console.error("oauth: id token rejected:", verified.reason);
      return to(verified.reason === "domain" ? "domain" : "error");
    }
    claims = verified.claims;
  } catch (e) {
    console.error("oauth: could not reach Google", e);
    return to("error");
  }

  // Strict read: an outage must read as "unavailable", never as "not registered".
  let users;
  try {
    users = await readUsers();
  } catch (e) {
    console.error("oauth: could not read users tab", e);
    return to("unavailable");
  }

  const match = matchUser(users, { sub: claims.sub, email: claims.email });
  if (match.kind !== "ok") {
    console.warn("oauth: sign-in refused:", match.kind);
    const flash: Flash = { reason: match.kind, email: claims.email };
    const res = to(match.kind);
    res.cookies.set(FLASH_COOKIE, await createFlashCookie(cfg.secret, flash), {
      httpOnly: true, secure: production, sameSite: "lax", path: "/login", maxAge: FLASH_TTL_SECONDS,
    });
    return res;
  }

  if (match.bindGoogleId) {
    // First sign-in: pin the row to this Google account (best effort, never blocks sign-in).
    try {
      const stamp = new Date().toISOString().replace("T", " ").replace("Z", "");
      const row = { ...match.user, googleId: claims.sub, updatedAt: stamp };
      await updateRowById("users", USER_COLUMNS, match.user.id, row as unknown as Record<string, string | boolean | null>);
    } catch (e) {
      console.error("oauth: could not bind googleId", e);
    }
  }

  const res = finish(NextResponse.redirect(new URL(safeNext(saved.next), base), 302));
  res.cookies.set(SESSION_COOKIE, await createSessionToken(cfg.secret, { uid: match.user.id, email: match.user.email }), {
    httpOnly: true, secure: production, sameSite: "lax", path: "/", maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
