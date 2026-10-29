"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { OrbitLogo } from "@/components/orbit-logo";

type AuthMode = "member" | "admin";
type AuthAction = "signin" | "signup" | "recovery";

function authenticationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
  const normalized = message.toLowerCase();

  if (normalized.includes("database error saving new user")) {
    return "Supabase could not create the member profile. Check that migrations 001–003 ran successfully in this project and that the signup username is not already in use.";
  }
  if (normalized.includes("profiles_username_lower_idx") || normalized.includes("duplicate key")) {
    return "That username is already in use. Choose a different username and try again.";
  }
  if (normalized.includes("redirect") || normalized.includes("redirect_to")) {
    return "Supabase rejected the email confirmation redirect. Add this app URL to Authentication → URL Configuration → Redirect URLs, then try again.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirm your email using the latest message from Supabase before signing in. You can request another confirmation email from this page.";
  }
  return message;
}

export function AuthPage() {
  const router = useRouter();
  const configured = Boolean(getSupabaseConfig());
  const [mode, setMode] = useState<AuthMode>("member");
  const [action, setAction] = useState<AuthAction>("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resendingConfirmation, setResendingConfirmation] = useState(false);

  function confirmationRedirectUrl() {
    return new URL("/auth/confirm", window.location.origin).toString();
  }

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
      if (params.get("auth") === "confirmation-failed") setMessage("Email confirmation could not be completed. Request a new confirmation email and use the latest link.");
    }, 0);

    if (configured) {
      void Promise.resolve()
        .then(() => createClient().auth.getSession())
        .then(({ data, error }) => {
          if (error) {
            console.error("Could not check the current Supabase session.", error);
            return;
          }
          if (data.session?.user) router.replace(data.session.user.app_metadata.role === "admin" ? "/admin" : "/member");
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

      if (action === "recovery") {
        const redirectUrl = new URL("/auth/confirm", window.location.origin);
        redirectUrl.searchParams.set("next", "/auth/reset-password");
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl.toString() });
        if (error) throw error;
        setMessage("If an account exists for this address, Supabase sent a password reset email.");
        return;
      }

      if (action === "signup") {
        const fullName = String(formData.get("fullName") ?? "").trim();
        const username = String(formData.get("username") ?? "").trim();
        if (username.toLowerCase() === "admin") {
          throw new Error("The ADMIN username is reserved for the platform administrator.");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, username },
            emailRedirectTo: confirmationRedirectUrl(),
          },
        });
        if (error) throw error;

        if (!data.session) {
          setConfirmationEmail(email);
          setMessage("If this address can be registered, Supabase sent a confirmation email. Confirm it before signing in. If you already have an account, sign in instead.");
          setAction("signin");
          return;
        }

        setConfirmationEmail("");
        router.replace("/member");
        router.refresh();
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const actualRole = data.user.app_metadata.role === "admin" ? "admin" : "member";
      if (actualRole !== mode) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;

        throw new Error(
          mode === "admin"
            ? "This is a member account. Sign in from the Member tab instead."
            : "This is an administrator account. Sign in from the Admin tab instead.",
        );
      }

      router.replace(actualRole === "admin" ? "/admin" : "/member");
      router.refresh();
    } catch (error) {
      setMessage(authenticationErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!confirmationEmail) return;
    setResendingConfirmation(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: confirmationEmail,
        options: { emailRedirectTo: confirmationRedirectUrl() },
      });
      if (error) throw error;
      setMessage("If this address has a pending confirmation, a new email has been sent. Use the latest confirmation link.");
    } catch (error) {
      setMessage(authenticationErrorMessage(error));
    } finally {
      setResendingConfirmation(false);
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
          <h2>{action === "signup" ? "Find your people." : action === "recovery" ? "Reset your password." : mode === "admin" ? "Admin sign in." : "Good to see you."}</h2>
          <p className="auth-subtitle">{action === "signup" ? "Create your member account and join the ORBIT community." : action === "recovery" ? "We’ll email you a secure link to choose a new password." : mode === "admin" ? "Sign in with the administrator account provisioned by the platform owner." : "Sign in to pick up where your crew left off."}</p>
          {(action === "signup" || action === "recovery") && <button className="auth-back-button" type="button" onClick={() => { setAction("signin"); setMessage(""); setPasswordVisible(false); }}><span aria-hidden="true">←</span> Back to sign in</button>}

          <div className="auth-mode-tabs" role="tablist" aria-label="Account type">
            <button type="button" className={mode === "member" ? "selected" : ""} onClick={() => { setMode("member"); setAction("signin"); setMessage(""); setPasswordVisible(false); }}>Member</button>
            <button type="button" className={mode === "admin" ? "selected" : ""} onClick={() => { setMode("admin"); setAction("signin"); setMessage(""); setPasswordVisible(false); }}>Admin</button>
          </div>

          {mode === "member" && <div className="auth-action-tabs"><button type="button" className={action === "signin" ? "selected" : ""} onClick={() => { setAction("signin"); setMessage(""); setPasswordVisible(false); }}>Sign in</button><button type="button" className={action === "signup" ? "selected" : ""} onClick={() => { setAction("signup"); setMessage(""); setPasswordVisible(false); }}>Create account</button></div>}

          <form key={`${mode}-${action}`} className="auth-form" onSubmit={submit}>
            {action === "signup" && mode === "member" && <label>Full name<input name="fullName" autoComplete="name" required maxLength={100} placeholder="How should we call you?" /></label>}
            {action === "signup" && mode === "member" && <label>Username<span className="username-input-wrap"><span>@</span><input name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" title="Use 3–24 letters, numbers, or underscores." placeholder="your_username" /></span></label>}
            <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
            {mode === "admin" && <p className="auth-field-hint">Use the email from the admin account in Supabase Authentication → Users. “ADMIN” is a profile username, not the sign-in email.</p>}
            {action !== "recovery" && <label>Password<span className="password-input-wrap"><input name="password" type={passwordVisible ? "text" : "password"} autoComplete={action === "signup" ? "new-password" : "current-password"} minLength={action === "signup" ? 8 : undefined} required placeholder={action === "signup" ? "At least 8 characters" : "Enter your password"} /><button className="password-visibility" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} onClick={() => setPasswordVisible((visible) => !visible)}><PasswordVisibilityIcon visible={passwordVisible} /></button></span></label>}
            {action === "signup" && <p className="auth-field-hint">After sign-up, confirm your email from the message Supabase sends before signing in.</p>}
            {message && <div className="auth-message" role="alert">{message}</div>}
            {confirmationEmail && mode === "member" && action === "signin" && <button className="auth-resend-button" type="button" onClick={() => void resendConfirmation()} disabled={resendingConfirmation}>{resendingConfirmation ? "Sending…" : "Resend confirmation email"}</button>}
            {!configured && <div className="auth-setup-note"><b>Connect Supabase to continue</b><span>Add the project URL and publishable key to <code>.env.local</code>. See the setup steps in README.</span></div>}
            <button className="button button-primary auth-submit" type="submit" disabled={!configured || busy}>{busy ? "One moment..." : action === "signup" ? "Create member account" : action === "recovery" ? "Send reset link" : mode === "admin" ? "Sign in as admin" : "Sign in"}<span>↗</span></button>
          </form>

          {mode === "member" && action === "signin" && <button className="auth-resend-button" type="button" onClick={() => { setAction("recovery"); setMessage(""); }}>Forgot your password?</button>}
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
