"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OrbitLogo } from "@/components/orbit-logo";
import { LanguageSwitcher, useLanguage } from "@/lib/i18n";

export function PasswordResetPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => createClient().auth.getUser()).then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        console.error("Could not verify the password reset session.", sessionError);
        setError("This reset link is invalid or has expired. Request a new one from the sign-in page.");
        return;
      }
      if (!data.user) {
        setError("This reset link is invalid or has expired. Request a new one from the sign-in page.");
        return;
      }
      setReady(true);
    }).catch((sessionError: unknown) => {
      console.error("Could not verify the password reset session.", sessionError);
      if (active) setError("Could not verify this reset link. Request a new one from the sign-in page.");
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      const destination = new URLSearchParams({ auth: "password-reset" });
      if (data.user?.app_metadata.role === "admin") destination.set("mode", "admin");
      router.replace(`/?${destination.toString()}`);
      router.refresh();
    } catch (resetError) {
      console.error("Could not reset the member password.", resetError);
      setError(resetError instanceof Error ? resetError.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page reset-password-page">
    <section className="auth-panel reset-password-panel">
      <div className="auth-language"><LanguageSwitcher /></div>
      <div className="auth-brand"><OrbitLogo className="auth-orbit-logo" /></div>
      <div className="auth-form-wrap">
        <span className="eyebrow">ACCOUNT SECURITY</span>
        <h2>{t("Choose a new password.")}</h2>
        <p className="auth-subtitle">{t("Create a new password for your ORBIT account.")}</p>
        {error && <div className="auth-message" role="alert">{error}</div>}
        {ready && <form className="auth-form" onSubmit={submit}>
          <label>{t("New password")}<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <label>{t("Confirm new password")}<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label>
          <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? t("Saving…") : t("Update password")}<span>↗</span></button>
        </form>}
        {!ready && !error && <p className="auth-subtitle">Verifying your secure reset link…</p>}
        <p className="auth-switch-prompt"><Link href="/">{t("Return to sign in")}</Link></p>
      </div>
    </section>
  </main>;
}
