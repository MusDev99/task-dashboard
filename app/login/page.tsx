import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FLASH_COOKIE, readAuthConfig, readFlashCookie, safeNext } from "../../lib/auth-core";
import { whatsappLink } from "../../lib/registration";

export const metadata: Metadata = { title: "Sign in · WorkForce Management" };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  unavailable: "We couldn't check your registration right now (the sheet is unreachable). Please try again in a minute.",
  denied: "Sign-in was cancelled. Choose your Google account to continue.",
  domain: "That Google account isn't from an allowed organisation. Use your work account.",
  throttled: "Too many attempts. Please wait a few minutes and try again.",
  error: "Sign-in didn't complete. Please try again.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const { next, e } = await searchParams;
  const cfg = readAuthConfig();

  // Registration refusals come with the person's Google email in a short-lived signed cookie.
  const flash = e === "not_registered" || e === "inactive" ? await readFlashCookie((await cookies()).get(FLASH_COOKIE)?.value, cfg.secret) : null;
  const refused = e === "not_registered" || e === "inactive" ? (e as "not_registered" | "inactive") : null;
  const who = flash?.email ?? "";
  const wa = whatsappLink(
    cfg.contactWhatsapp,
    `Hi, I'd like access to WorkForce Management.${who ? ` My Google account is ${who}.` : ""}`
  );

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">WorkForce Management is invite-only. Sign in with the Google account you were registered with.</p>

        {refused && (
          <div className="alert alert-warning login-refused" role="alert">
            <strong>{refused === "inactive" ? "Your account is deactivated." : who ? `${who} isn't registered.` : "This Google account isn't registered."}</strong>
            <span>{refused === "inactive" ? " Ask the admin to reactivate it." : " Ask the admin to add you."}</span>
            {wa && (
              <a className="btn login-contact" href={wa} target="_blank" rel="noopener noreferrer">
                Contact me on WhatsApp
              </a>
            )}
          </div>
        )}
        {e === "unconfigured" || !cfg.configured ? (
          <div className="alert alert-danger" role="alert">
            Sign-in is not configured. Set <code>AUTH_SECRET</code>, <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in the server environment.
          </div>
        ) : null}
        {e && MESSAGES[e] && (
          <div className="alert alert-danger" role="alert">{MESSAGES[e]}</div>
        )}

        {cfg.configured && (
          <a className="btn btn-primary login-submit" href={`/api/auth/google?next=${encodeURIComponent(safeNext(next))}`}>
            Sign in with Google
          </a>
        )}
      </div>
    </div>
  );
}
