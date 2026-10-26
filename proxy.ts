import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readAuthConfig, verifySessionToken } from "./lib/auth-core";

// Next 16 "proxy" (formerly middleware): everything except /login and the OAuth routes needs a session (OWASP A01).
// This app holds staff names, emails and phone numbers, so reads are private too.
export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  // /login shows the Google button; /api/auth/* is the OAuth start + callback (they establish the session).
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) return NextResponse.next();

  const cfg = readAuthConfig();
  const production = process.env.NODE_ENV === "production";

  if (!cfg.configured) {
    if (!production || process.env.AUTH_DISABLED === "true") return NextResponse.next(); // explicit opt-out / local dev
    // Fail closed: an unconfigured production deploy must not be world-editable.
    return new NextResponse(
      "Sign-in is not configured. Set AUTH_SECRET, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server environment (see README).",
      { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }
    );
  }

  if (await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value, cfg.secret)) return NextResponse.next();

  // Server-action calls can't follow a redirect meaningfully: answer 401.
  if (req.headers.has("next-action")) return new NextResponse("Unauthorized", { status: 401 });

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

// Static PWA files (manifest, service worker, icons, offline page) stay public: the browser fetches them without a session.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/).*)"] };
