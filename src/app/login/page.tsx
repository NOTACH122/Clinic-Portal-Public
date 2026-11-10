"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import Logo from "@/components/Logo";
import LanguageToggle from "@/components/LanguageToggle";
import CompanyFooter from "@/components/CompanyFooter";
import { resolveLoginEmail } from "./actions";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const identifier = emailOrPhone.trim();

    const email = await resolveLoginEmail(identifier);
    if (!email) {
      setError(t.login.invalidCredentials);
      setLoading(false);
      return;
    }

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (signInError || !signInData.user) {
      setError(t.login.invalidCredentials);
      setLoading(false);
      return;
    }

    // Supabase's own session cookie always persists ~400 days regardless of
    // this flag, so "remember me" is enforced via this separate marker that
    // the middleware checks: a 30-day cookie when checked, a browser-session
    // cookie (gone once the browser closes) when not.
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const maxAge = rememberMe ? `; max-age=${60 * 60 * 24 * 30}` : "";
    document.cookie = `remembered=1; path=/${maxAge}; SameSite=Lax${secure}`;

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .single();

    if (profileError || !profile) {
      setError(t.login.accountNotSetUp);
      setLoading(false);
      return;
    }

    const destination = profile.role === "admin" ? "/admin" : "/dashboard";
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <LanguageToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-[380px] rounded-2xl border border-border bg-surface p-7 sm:p-9">
          <div className="mb-7 flex flex-col items-center gap-4">
            <Logo size={44} withWordmark />
            <div className="text-center">
              <h1 className="text-[19px] font-bold text-foreground">
                {t.login.title}
              </h1>
              <p className="mt-1 text-[13px] text-secondary">
                {t.login.subtitle}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-[12.5px] font-semibold text-secondary"
              >
                {t.login.email}
              </label>
              <input
                id="email"
                type="text"
                required
                autoComplete="username"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12.5px] font-semibold text-secondary"
              >
                {t.login.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 pr-10 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword ? t.login.hidePassword : t.login.showPassword
                  }
                  className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md p-1.5 text-secondary hover:text-foreground"
                >
                  {showPassword ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-secondary">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-accent"
              />
              {t.login.rememberMe}
            </label>

            {error && (
              <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-3.5 py-2.5 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? t.login.signingIn : t.login.signIn}
            </button>
          </form>
        </div>
      </div>

      <CompanyFooter />
    </div>
  );
}
