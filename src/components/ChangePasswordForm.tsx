"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function ChangePasswordForm() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(t.dashboard.passwordMismatch);
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      setError(t.admin.signedOutError);
      setSubmitting(false);
      return;
    }

    // Re-verify the current password before allowing the change, so a
    // session left open on a shared computer can't be used to lock out
    // the real owner.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (reauthError) {
      setError(t.dashboard.incorrectCurrentPassword);
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.dashboard.currentPassword}
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.dashboard.newPassword}
        </label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.dashboard.confirmPassword}
        </label>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-accent bg-accent-wash px-3.5 py-2.5 text-[13.5px] font-semibold text-accent-dark">
          {t.dashboard.passwordChanged}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t.dashboard.changing : t.dashboard.changePasswordButton}
      </button>
    </form>
  );
}
