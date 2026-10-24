import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readAuthConfig, verifySessionToken } from "./auth-core";

/** True when auth is switched off on purpose (local dev without a password, or AUTH_DISABLED=true). */
export function authBypassed(): boolean {
  const cfg = readAuthConfig();
  if (cfg.configured) return false;
  return process.env.NODE_ENV !== "production" || process.env.AUTH_DISABLED === "true";
}

export async function isAuthed(): Promise<boolean> {
  if (authBypassed()) return true;
  const cfg = readAuthConfig();
  if (!cfg.configured) return false;
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, cfg.secret);
}

/**
 * Defence in depth for server actions: the proxy already blocks unauthenticated requests, but every
 * "use server" export is a public POST endpoint, so each one re-checks the session itself (OWASP A01).
 */
export async function requireSession(): Promise<void> {
  if (!(await isAuthed())) throw new Error("Unauthorized");
}
