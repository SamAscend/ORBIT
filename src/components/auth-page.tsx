"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { OrbitLogo } from "@/components/orbit-logo";

type AuthMode = "member" | "admin";
type AuthAction = "signin" | "signup";

export function AuthPage() {
  const router = useRouter();
  const configured = Boolean(getSupabaseConfig());
  const [mode, setMode] = useState<AuthMode>("member");
  const [action, setAction] = useState<AuthAction>("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.removeItem("orbit-demo-v1");
      window.localStorage.removeItem("milezero-demo-v1");
    } catch (error) {
      console.error("Could not clear the previous demo data.", error);
    }

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "admin") setMode("admin");
      if (params.get("setup") === "required") setMessage("Set up the Supabase project keys in .env.local before signing in.");
      if (params.get("access") === "membership") setMessage("This account does not currently have an active ORBIT membership. Contact a community administrator.");
    }, 0);

    if (configured) {
      void Promise.resolve()
        .then(() => createClient().auth.getUser())
        .then(({ data, error }) => {
          if (error) {
            console.error("Could not check the current Supabase session.", error);
            return;
          }
          if (data.user) router.replace(data.user.app_metadata.role === "admin" ? "/admin" : "/member");
        })
        .catch((error: unknown) => console.error("Could not check the current Supabase session.", error));
    }

    return () => window.clearTimeout(timer);
  }, [configured, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setBusy(true);

    try {
      const supabase = createClient();
      const formData = new FormData(event.currentTarget);
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "");

      if (action === "signup") {
        const fullName = String(formData.get("fullName") ?? "").trim();
        const username = String(formData.get("username") ?? "").trim();
        if (username.toLowerCase() === "admin") {
          throw new Error("The ADMIN username is reserved for the platform administrator.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, username } },
        });
        if (error) throw error;

        if (!data.session) {
          setMessage("Your account is ready. Check your email to confirm it, then sign in.");
          setAction("signin");
          return;
        }

        router.replace("/member");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const actualRole = data.user.app_metadata.role === "admin" ? "admin" : "member";
      if (mode === "admin" && actualRole !== "admin") {
        await supabase.auth.signOut();
        throw new Error("This account is not an administrator. Ask the platform owner to provision admin access.");
      }

      router.replace(actualRole === "admin" ? "/admin" : "/member");
      router.refresh();
    } catch (error) {
      console.error("Authentication request failed.", error);
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><OrbitLogo className="auth-orbit-logo" /></div>
        <div className="auth-story-copy">
          <span className="eyebrow">A COMMUNITY, IN MOTION</span>
          <h1>Better together.<br /><em>One step at a time.</em></h1>
          <p>Find your people, show up for each other, and make every mile mean a little more.</p>
        </div>
        <div className="auth-story-bottom"><span>✳</span><p>Made for the miles ahead.</p></div>
        <span className="auth-orbit auth-orbit-one" /><span className="auth-orbit auth-orbit-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-form-wrap">
          <span className="eyebrow">{mode === "admin" ? "PLATFORM ADMINISTRATION" : "WELCOME TO YOUR CREW"}</span>
          <h2>{action === "signup" ? "Find your people." : mode === "admin" ? "Admin sign in." : "Good to see you."}</h2>
          <p className="auth-subtitle">{action === "signup" ? "Create your member account and join the ORBIT community." : mode === "admin" ? "Sign in with the administrator account provisioned by the platform owner." : "Sign in to pick up where your crew left off."}</p>

          <div className="auth-mode-tabs" role="tablist" aria-label="Account type">
            <button type="button" className={mode === "member" ? "selected" : ""} onClick={() => { setMode("member"); setAction("signin"); setMessage(""); setPasswordVisible(false); }}>Member</button>
            <button type="button" className={mode === "admin" ? "selected" : ""} onClick={() => { setMode("admin"); setAction("signin"); setMessage(""); setPasswordVisible(false); }}>Admin</button>
          </div>

          {mode === "member" && <div className="auth-action-tabs"><button type="button" className={action === "signin" ? "selected" : ""} onClick={() => { setAction("signin"); setMessage(""); setPasswordVisible(false); }}>Sign in</button><button type="button" className={action === "signup" ? "selected" : ""} onClick={() => { setAction("signup"); setMessage(""); setPasswordVisible(false); }}>Create account</button></div>}

          <form key={`${mode}-${action}`} className="auth-form" onSubmit={submit}>
            {action === "signup" && mode === "member" && <label>Full name<input name="fullName" autoComplete="name" required maxLength={100} placeholder="How should we call you?" /></label>}
            {action === "signup" && mode === "member" && <label>Username<span className="username-input-wrap"><span>@</span><input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title="Use 3–24 letters, numbers, or underscores." placeholder="your_username" /></span></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
            <label>Password<span className="password-input-wrap"><input name="password" type={passwordVisible ? "text" : "password"} autoComplete={action === "signup" ? "new-password" : "current-password"} minLength={8} required placeholder={action === "signup" ? "At least 8 characters" : "Enter your password"} /><button className="password-visibility" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}><PasswordVisibilityIcon visible={passwordVisible} /></button></span></label>
            {message && <div className="auth-message" role="status">{message}</div>}
            {!configured && <div className="auth-setup-note"><b>Connect Supabase to continue</b><span>Add the project URL and publishable key to <code>.env.local</code>. See the setup steps in README.</span></div>}
            <button className="button button-primary auth-submit" type="submit" disabled={!configured || busy}>{busy ? "One moment..." : action === "signup" ? "Create member account" : mode === "admin" ? "Sign in as admin" : "Sign in"}<span>↗</span></button>
          </form>

          {mode === "member" && action === "signin" && <p className="auth-switch-prompt">New around here? <button onClick={() => { setAction("signup"); setMessage(""); }}>Create a member account</button></p>}
          {mode === "admin" && <p className="auth-admin-note">Admin accounts are created by the platform owner. There is no public admin sign-up.</p>}
          <p className="auth-legal">By continuing, you agree to use this community respectfully and keep members’ information private.</p>
        </div>
        <div className="auth-footer"><span>© 2026 ORBIT</span><span>GOOD THINGS HAPPEN TOGETHER</span></div>
      </section>
    </main>
  );
}

function PasswordVisibilityIcon({ visible }: { visible: boolean }) {
  return (
    <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {visible ? <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></> : <><path d="m3 3 18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a14.6 14.6 0 0 1-3.1 3.8M6.2 6.2C3.5 8 2 12 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.8-.8" /></>}
    </svg>
  );
}
