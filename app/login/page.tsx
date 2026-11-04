import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FLASH_COOKIE, authConfigProblems, readAuthConfig, readFlashCookie, safeNext } from "../../lib/auth-core";
import { whatsappLink } from "../../lib/registration";
import GoogleSignInButton from "./GoogleSignInButton";
import LoginPreview from "./LoginPreview";

export const metadata: Metadata = { title: "Sign in · WorkForce Management" };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  unavailable: "We couldn't check your registration right now (the data store is unreachable). Please try again in a minute.",
  denied: "Sign-in was cancelled. Choose your Google account to continue.",
  domain: "That Google account isn't from an allowed organisation. Use your work account.",
  throttled: "Too many attempts. Please wait a few minutes and try again.",
  error: "Sign-in didn't complete. Please try again.",
};

const icon = (paths: React.ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);

// Marketing copy for the sign-in page (not data): what the product does, in four short lines.
const FEATURES: { title: string; text: string; tone: "indigo" | "amber" | "emerald" | "pink"; icon: React.ReactNode }[] = [
  { title: "Roster first", text: "Shifts, leave and who's unscheduled, day by day.", tone: "indigo", icon: icon(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>) },
  { title: "Tasks by availability", text: "Workload and leave warnings before you assign.", tone: "amber", icon: icon(<><rect x="3" y="3" width="7" height="18" rx="1.5" /><rect x="14" y="3" width="7" height="11" rx="1.5" /></>) },
  { title: "Leave & approvals", text: "Request, approve, and the roster updates itself.", tone: "emerald", icon: icon(<><polyline points="20 6 9 17 4 12" /></>) },
  { title: "Invite-only", text: "Access follows your team list, one Google account each.", tone: "pink", icon: icon(<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></>) },
];

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
    <div className="login-shell">
      <div className="landing">
        <div className="landing-main">
          <div className="landing-brand">
            <span className="landing-mark" aria-hidden="true">⚡</span>
            <span className="landing-name">Work<span>Force</span></span>
          </div>

          <h1 className="landing-title">
            Plan the roster.
            <span>Assign by availability.</span>
          </h1>
          <p className="landing-sub">See who&apos;s on shift, on leave or free, then give work to the right person. Leave, rest and coverage checks are built in.</p>

          <div className="landing-auth">
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
                {process.env.NODE_ENV !== "production" && (
                  <>
                    {" "}
                    <strong>This server sees:</strong>
                    <ul className="login-problems">
                      {authConfigProblems().map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <span>Edit <code>.env</code> in the project root, then stop and restart <code>npm run dev</code> (Next only reads it at start-up). Sign-in is skipped in development until this is fixed.</span>
                  </>
                )}
              </div>
            ) : null}
            {e && MESSAGES[e] && (
              <div className="alert alert-danger" role="alert">{MESSAGES[e]}</div>
            )}

            {cfg.configured && <GoogleSignInButton href={`/api/auth/google?next=${encodeURIComponent(safeNext(next))}`} />}

            <p className="landing-note">
              {refused ? "Signed in with the wrong account? Use the button to pick another." : "Invite-only: use the Google account you were registered with. We only read your name, email and photo."}
            </p>
          </div>

          <ul className="landing-features" aria-label="What you can do">
            {FEATURES.map((f) => (
              <li key={f.title} className="landing-feature">
                <span className={`landing-feature-icon tone-${f.tone}`} aria-hidden="true">{f.icon}</span>
                <span><strong>{f.title}</strong><small>{f.text}</small></span>
              </li>
            ))}
          </ul>
        </div>

        <LoginPreview />
      </div>
    </div>
  );
}
