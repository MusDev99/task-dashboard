import { NextResponse, type NextRequest } from "next/server";
import {
  OAUTH_COOKIE, OAUTH_TTL_SECONDS, clientIp, createOAuthCookie, createRateLimiter, readAuthConfig, safeNext,
} from "../../../../lib/auth-core";
import { buildAuthUrl, googleEndpoints, pkceChallenge, randomToken } from "../../../../lib/oidc";

export const dynamic = "force-dynamic";

const g = globalThis as { __oauthStartLimiter?: ReturnType<typeof createRateLimiter> };
const limiter = (g.__oauthStartLimiter ??= createRateLimiter(20, 10 * 60 * 1000));

/** Step 1: remember state / nonce / PKCE verifier in a signed cookie, then send the person to Google. */
export async function GET(req: NextRequest) {
  const cfg = readAuthConfig();
  const base = cfg.appUrl || req.nextUrl.origin;
  const to = (code: string) => NextResponse.redirect(new URL(`/login?e=${code}`, base), 302);

  if (!cfg.configured) return to("unconfigured");
  if (!limiter.take(clientIp(req))) return to("throttled");

  const production = process.env.NODE_ENV === "production";
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken(48);
  const url = buildAuthUrl(googleEndpoints, {
    clientId: cfg.googleClientId,
    redirectUri: `${base}/api/auth/google/callback`,
    state,
    nonce,
    challenge: await pkceChallenge(verifier),
    hd: cfg.allowedDomain || undefined,
  });

  const res = NextResponse.redirect(url, 302);
  res.cookies.set(OAUTH_COOKIE, await createOAuthCookie(cfg.secret, { state, nonce, verifier, next: safeNext(req.nextUrl.searchParams.get("next")) }), {
    httpOnly: true,
    secure: production,
    sameSite: "lax", // must accompany the top-level GET back from Google
    path: "/api/auth",
    maxAge: OAUTH_TTL_SECONDS,
  });
  return res;
}
