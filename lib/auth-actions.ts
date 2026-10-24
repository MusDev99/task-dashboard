"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE, SESSION_TTL_SECONDS, clientIp, createRateLimiter, createSessionToken,
  passwordMatches, readAuthConfig, safeNext,
} from "./auth-core";

export type LoginState = { error?: string };

// 5 attempts / 10 min / IP. In-memory (per serverless instance): a speed bump, not a hard limit; add a WAF rule for that.
const g = globalThis as { __loginLimiter?: ReturnType<typeof createRateLimiter> };
const limiter = (g.__loginLimiter ??= createRateLimiter(5, 10 * 60 * 1000));

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const cfg = readAuthConfig();
  if (!cfg.configured) return { error: "Sign-in is not configured on this server." };

  const h = await headers();
  const ip = clientIp(new Request("http://x", { headers: h }));
  if (!limiter.take(ip)) return { error: "Too many attempts. Please wait a few minutes and try again." };

  const password = String(form.get("password") ?? "").slice(0, 200);
  if (!(await passwordMatches(password, cfg.password, cfg.secret))) {
    return { error: "Incorrect password." }; // one message for every failure: no hints (OWASP A07)
  }

  limiter.reset(ip);
  (await cookies()).set(SESSION_COOKIE, await createSessionToken(cfg.secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(safeNext(String(form.get("next") ?? ""), "/"));
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
