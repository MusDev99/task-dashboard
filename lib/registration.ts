// Who may sign in: an active row in the `users` tab. Pure, no data-store access, no relative imports.

export interface RegistrableUser {
  id: string;
  email: string;
  googleId: string | null;
  isActive: boolean;
}

export type Registration<U extends RegistrableUser> =
  | { kind: 'ok'; user: U; bindGoogleId: boolean }
  | { kind: 'not_registered' }
  | { kind: 'inactive' };

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Google's stable `sub` wins; otherwise the (case-insensitive) email. A row already bound to a *different*
 * Google account is treated as not registered, so a reused or typo'd email can't take over someone's row.
 */
export function matchUser<U extends RegistrableUser>(users: U[], who: { sub: string; email: string }): Registration<U> {
  const email = normalizeEmail(who.email);
  const bySub = users.find((u) => u.googleId && u.googleId === who.sub);
  const byEmail = users.find((u) => normalizeEmail(u.email) === email && (!u.googleId || u.googleId === who.sub));
  const user = bySub ?? byEmail;
  if (!user) return { kind: 'not_registered' };
  if (!user.isActive) return { kind: 'inactive' };
  return { kind: 'ok', user, bindGoogleId: !user.googleId };
}

/** `https://wa.me/<digits>?text=...` or null when no usable number is configured. */
export function whatsappLink(number: string, text: string): string | null {
  const digits = number.replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
