import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readAuthConfig, verifySessionToken, type SessionUser } from "./auth-core";
import { readUsers } from "./actions";
import { FORBIDDEN_MESSAGE, can, type AccessLevel, type Capability } from "./access";

/** True when auth is switched off on purpose (local dev without Google set up, or AUTH_DISABLED=true). */
export function authBypassed(): boolean {
  if (readAuthConfig().configured) return false;
  return process.env.NODE_ENV !== "production" || process.env.AUTH_DISABLED === "true";
}

/** The signed-in person from the session cookie; null when signed out (or when auth is bypassed). */
export async function currentUser(): Promise<SessionUser | null> {
  const cfg = readAuthConfig();
  if (!cfg.configured) return null;
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, cfg.secret);
}

export async function isAuthed(): Promise<boolean> {
  if (authBypassed()) return true;
  return (await currentUser()) !== null;
}

/**
 * Defence in depth for server actions: the proxy already blocks unauthenticated requests, but every
 * "use server" export is a public POST endpoint, so each one re-checks the session itself (OWASP A01).
 */
export async function requireSession(): Promise<void> {
  if (!(await isAuthed())) throw new Error("Unauthorized");
}

export interface Actor {
  uid: string;
  level: AccessLevel;
}

/**
 * The signed-in person and their access level, read from the users tab on every call (not from the cookie),
 * so a demotion or deactivation applies to their next action. Fails closed: no session, an unknown or inactive
 * user, or a data-store outage all throw. With auth bypassed (local dev / AUTH_DISABLED) the caller is an admin.
 */
export async function requireActor(): Promise<Actor> {
  if (authBypassed()) return { uid: "", level: "admin" };
  const who = await currentUser();
  if (!who) throw new Error("Unauthorized");
  const me = (await readUsers()).find((u) => u.id === who.uid);
  if (!me || !me.isActive) throw new Error("Unauthorized");
  return { uid: me.id, level: me.access };
}

/** Logs a refused action (who + what, never the payload) and returns the generic result for the client. */
export function forbidden(action: string, actor: Actor): { ok: false; message: string } {
  console.warn(`access denied: ${action} (uid=${actor.uid || "-"}, level=${actor.level})`);
  return { ok: false, message: FORBIDDEN_MESSAGE };
}

/** First line of a write action: the actor, plus a ready-to-return refusal when their level lacks `capability`. */
export async function actorWith(capability: Capability, action: string): Promise<{ actor: Actor; denied: { ok: false; message: string } | null }> {
  const actor = await requireActor();
  return can(actor.level, capability) ? { actor, denied: null } : { actor, denied: forbidden(action, actor) };
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

/** Name + avatar for the sidebar. Falls back to the email if the data store can't be read (never blocks a page). */
export async function currentProfile(): Promise<Profile | null> {
  const who = await currentUser();
  if (!who) return null;
  try {
    const u = (await readUsers()).find((x) => x.id === who.uid);
    if (u) return { id: u.id, name: u.name, email: u.email, avatar: u.avatar };
  } catch (e) {
    console.error("currentProfile: could not read users", e);
  }
  return { id: who.uid, name: who.email, email: who.email, avatar: null };
}
