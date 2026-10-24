import type { Metadata } from "next";
import LoginForm from "./LoginForm";
import { readAuthConfig } from "../../lib/auth-core";

export const metadata: Metadata = { title: "Sign in · WorkForce Management" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const configured = readAuthConfig().configured;
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1 className="login-title">Sign in</h1>
        <p className="login-sub">WorkForce Management is private. Enter the team password to continue.</p>
        {configured ? (
          <LoginForm next={next ?? "/"} />
        ) : (
          <div className="alert alert-danger" role="alert">
            Sign-in is not configured. Set <code>ADMIN_PASSWORD</code> and <code>AUTH_SECRET</code> in the server environment.
          </div>
        )}
      </div>
    </div>
  );
}
