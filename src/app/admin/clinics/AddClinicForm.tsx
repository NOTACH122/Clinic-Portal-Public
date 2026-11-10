"use client";

import { useActionState, useState } from "react";
import { createClinicLogin, type CreateClinicState } from "./actions";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const initialState: CreateClinicState = {};

export default function AddClinicForm() {
  const [state, formAction, pending] = useActionState(
    createClinicLogin,
    initialState,
  );
  // One entry per email input row. Values live in the DOM (uncontrolled) -
  // this only tracks how many rows to render.
  const [emailRows, setEmailRows] = useState([0]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const { t } = useTranslation();

  async function copyPassword(password: string, index: number) {
    await navigator.clipboard.writeText(password);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  async function copyAll() {
    if (!state.success) return;
    const text = state.success.logins
      .map((login) => `${login.email}  ${login.password}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedIndex(-1);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="mb-4 text-[15px] font-bold text-foreground">
        {t.clinics.addNewClinic}
      </h2>

      <form
        action={formAction}
        className="space-y-4"
        key={state.success ? state.success.clinicName : "form"}
      >
        <div>
          <label
            htmlFor="clinicName"
            className="mb-1.5 block text-[12.5px] font-semibold text-secondary"
          >
            {t.clinics.clinicName}
          </label>
          <input
            id="clinicName"
            name="clinicName"
            type="text"
            required
            className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
            {t.clinics.loginEmails}
          </label>
          <div className="flex flex-col gap-2">
            {emailRows.map((rowId, index) => (
              <div key={rowId} className="flex items-center gap-2">
                <input
                  name="email"
                  type="email"
                  required={index === 0}
                  className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
                />
                {emailRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setEmailRows((rows) => rows.filter((r) => r !== rowId))
                    }
                    className="shrink-0 rounded-lg border border-transparent px-2.5 py-1.5 text-[12.5px] font-semibold text-danger hover:bg-danger-wash"
                  >
                    {t.clinics.removeEmailRow}
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setEmailRows((rows) => [...rows, (rows[rows.length - 1] ?? 0) + 1])
            }
            className="mt-2 text-[12.5px] font-semibold text-accent-dark hover:underline"
          >
            {t.clinics.addEmailRow}
          </button>
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-1.5 block text-[12.5px] font-semibold text-secondary"
          >
            {t.clinics.loginPhone}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue="+995"
            className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t.clinics.creating : t.clinics.addClinicButton}
        </button>
      </form>

      {state.success && (
        <div className="mt-4 rounded-xl border border-accent bg-accent-wash p-4">
          <p className="mb-2.5 text-[13.5px] font-semibold text-accent-dark">
            {t.clinics.clinicCreated(state.success.clinicName)}
          </p>

          {state.success.phone && (
            <code className="mb-2.5 inline-block rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-foreground">
              {state.success.phone}
            </code>
          )}

          <ul className="flex flex-col gap-2">
            {state.success.logins.map((login, index) => (
              <li key={login.email} className="flex flex-wrap items-center gap-2">
                <code className="rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-foreground">
                  {login.email}
                </code>
                <code className="rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-foreground">
                  {login.password}
                </code>
                <button
                  type="button"
                  onClick={() => copyPassword(login.password, index)}
                  className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-muted"
                >
                  {copiedIndex === index ? t.clinics.copied : t.clinics.copyPassword}
                </button>
              </li>
            ))}
          </ul>

          {state.success.logins.length > 1 && (
            <button
              type="button"
              onClick={copyAll}
              className="mt-2.5 text-[12.5px] font-semibold text-accent-dark hover:underline"
            >
              {copiedIndex === -1 ? t.clinics.copied : t.clinics.copyPassword}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
