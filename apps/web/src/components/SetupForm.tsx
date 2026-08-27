'use client'

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "../lib/i18n";
import { trackPostHog } from "../lib/posthog";
import { fetchVerificationStatus } from "../api/auth";

const bowlby = "'Bowlby One', system-ui";

// How often the "check your email" screen polls to see if the user verified
// from a link opened in a different tab — cheap enough to poll often, the
// endpoint has its own generous rate limit for exactly this use case.
const VERIFICATION_POLL_MS = 4000;

interface SetupFormProps {
  onSubmit: (username: string, email: string, password: string) => Promise<unknown>;
  login: (username: string, password: string) => Promise<unknown>;
  error: string | null;
  isPending: boolean;
  onBack: () => void;
  onSwitchToLogin: () => void;
}

export default function SetupForm({
  onSubmit,
  login,
  error,
  isPending,
  onBack,
  onSwitchToLogin,
}: SetupFormProps) {
  const { t: tr } = useLanguage();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  const params = useSearchParams();
  const plan = params.get('plan') === 'pro' ? 'pro' : 'starter';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (!username.trim() || !email.trim() || !password.trim()) return;
    try {
      await onSubmit(username.trim(), email.trim(), password);
      // Remember the chosen plan so a Pro signup is charged right after
      // email verification + login (the verify link can't carry this).
      if (plan === 'pro') localStorage.setItem('sandwich_pending_plan', 'pro');
      trackPostHog('signup_completed', { plan });
      setRegistered(true);
    } catch {
      /* error surfaced via error prop */
    }
  };

  // This tab already has the credentials the user just chose — once the
  // verification link they open in another tab (e.g. from their email
  // client) marks the account verified, log this tab in automatically
  // instead of leaving it stuck on "check your email".
  useEffect(() => {
    if (!registered) return;
    let cancelled = false;
    const tick = async () => {
      const verified = await fetchVerificationStatus(email).catch(() => false);
      if (cancelled || !verified) return;
      clearInterval(interval);
      const loggedIn = await login(username, password).then(() => true).catch(() => false);
      if (cancelled || !loggedIn) return;
      // A full navigation (not router.push) guarantees the dashboard's
      // first render sees the session cookie this login just set — the
      // same effect a manual refresh had, just automatic.
      window.location.href = '/dashboard';
    };
    const interval = setInterval(() => void tick(), VERIFICATION_POLL_MS);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [registered, email, username, password, login]);

  if (registered) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10"
        style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#F4EBE1" }}
      >
        <div
          className="w-full max-w-sm rounded-3xl p-8"
          style={{ backgroundColor: "#ffffff", boxShadow: "0 20px 50px rgba(0,0,0,0.08)" }}
        >
          <h1 className="text-2xl text-center tracking-tight mb-1.5" style={{ fontFamily: bowlby, color: "#111827" }}>
            {tr("setup_verify_sent_title")}
          </h1>
          <p className="text-sm text-zinc-500 text-center mb-6">{tr("setup_verify_sent_desc")}</p>
          <button
            onClick={onBack}
            className="w-full py-3 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: "#0a0a0a" }}
          >
            {tr("auth_back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center antialiased px-4 py-10 relative"
      style={{
        fontFamily: "'Inter', sans-serif",
        backgroundColor: "#F4EBE1",
      }}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-8"
        style={{
          backgroundColor: "#ffffff",
          boxShadow: "0 20px 50px rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex justify-center mb-6">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: "#f91814" }}
          >
            <iconify-icon
              icon="solar:user-plus-bold"
              width="24"
              className="text-white"
            />
          </div>
        </div>

        <h1
          className="text-2xl text-center tracking-tight mb-1.5"
          style={{ fontFamily: bowlby, color: "#111827" }}
        >
          {tr("setup_title")}
        </h1>
        <p className="text-sm text-zinc-500 text-center mb-7">
          {tr("setup_subtitle")}
        </p>



        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label htmlFor="setup-username" className="sr-only">{tr("setup_username_label")}</label>
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: "#F4EBE1" }}
          >
            <iconify-icon
              icon="solar:user-linear"
              width="18"
              style={{ color: "rgba(0,0,0,0.35)", display: "block" }}
            />
            <input
              id="setup-username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              placeholder={tr('setup_username_placeholder')}
              className="flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 outline-none"
            />
          </div>

          <label htmlFor="setup-email" className="sr-only">{tr("setup_email_label")}</label>
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: "#F4EBE1" }}
          >
            <iconify-icon
              icon="solar:letter-linear"
              width="18"
              style={{ color: "rgba(0,0,0,0.35)", display: "block" }}
            />
            <input
              id="setup-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder={tr('setup_email_placeholder')}
              className="flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 outline-none"
            />
          </div>

          <label htmlFor="setup-password" className="sr-only">{tr("setup_password_label")}</label>
          <div
            className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: "#F4EBE1" }}
          >
            <iconify-icon
              icon="solar:lock-password-linear"
              width="18"
              style={{ color: "rgba(0,0,0,0.35)", display: "block" }}
            />
            <input
              id="setup-password"
              name="new-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder={tr('setup_pass_placeholder')}
              className="flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? tr('password_hide') : tr('password_show')}
              className="shrink-0 flex items-center"
              style={{ color: "rgba(0,0,0,0.35)" }}
            >
              <iconify-icon
                icon={
                  showPassword
                    ? "solar:eye-closed-linear"
                    : "solar:eye-linear"
                }
                width="18"
              />
            </button>
          </div>

          {error && (
            <p
              className="text-xs font-medium rounded-lg px-3 py-2"
              style={{
                color: "#f91814",
                backgroundColor: "rgba(249,24,20,0.08)",
              }}
            >
              {error}
            </p>
          )}

          <p className="text-[11px] text-zinc-400 text-center leading-relaxed">
            {tr("setup_legal_prefix")}{" "}
            <Link href="/terms" className="underline hover:text-zinc-600">
              {tr("footer_terms")}
            </Link>{" "}
            {tr("setup_legal_and")}{" "}
            <Link href="/privacy" className="underline hover:text-zinc-600">
              {tr("footer_privacy")}
            </Link>
            .
          </p>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            style={{ backgroundColor: "#0a0a0a" }}
          >
            {isPending ? tr("setup_pending") : tr("setup_cta")}
          </button>
        </form>

        <button
          onClick={onBack}
          className="w-full py-3 rounded-full text-sm font-semibold transition-colors hover:opacity-80 mt-2 flex items-center justify-center gap-1.5"
          style={{
            border: "1.5px solid #0a0a0a",
            color: "#0a0a0a",
            backgroundColor: "transparent",
          }}
        >
          <iconify-icon icon="solar:arrow-left-linear" width="16" />
          {tr("auth_back")}
        </button>

        <p className="text-center text-xs text-zinc-400 mt-4">
          {tr("auth_have_account")}{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-semibold underline"
            style={{ color: "#f91814" }}
          >
            {tr("auth_login_link")}
          </button>
        </p>
      </div>
    </div>
  );
}
