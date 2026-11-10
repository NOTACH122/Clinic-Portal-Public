"use client";

import { useActionState, useState } from "react";
import {
  resetClinicPassword,
  deleteClinic,
  addClinicLogin,
  removeClinicLogin,
  type ResetPasswordState,
  type DeleteClinicState,
  type AddLoginState,
  type RemoveLoginState,
} from "./actions";
import { useTranslation } from "@/lib/i18n/LanguageContext";

const resetInitialState: ResetPasswordState = {};
const deleteInitialState: DeleteClinicState = {};
const addInitialState: AddLoginState = {};
const removeInitialState: RemoveLoginState = {};

const DATE_LOCALES: Record<string, string> = {
  ka: "ka-GE",
  ru: "ru-RU",
  en: "en-US",
};

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(DATE_LOCALES[locale] ?? "en-US", {
    dateStyle: "medium",
  }).format(new Date(iso));
}

export type ClinicLoginRow = { profileId: string; email: string };

function CopyableCredentials({
  email,
  password,
  title,
}: {
  email: string;
  password: string;
  title: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-2.5 rounded-xl border border-accent bg-accent-wash p-3.5">
      <p className="mb-2.5 text-[13px] font-semibold text-accent-dark">{title}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-foreground">
          {email}
        </code>
        <code className="rounded-md bg-surface px-2.5 py-1.5 text-[13px] text-foreground">
          {password}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded-md border border-border-strong bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-muted"
        >
          {copied ? t.clinics.copied : t.clinics.copyPassword}
        </button>
      </div>
    </div>
  );
}

export default function ClinicRow({
  id,
  name,
  createdAt,
  logins,
  phone,
}: {
  id: string;
  name: string;
  createdAt: string;
  logins: ClinicLoginRow[];
  phone?: string;
}) {
  const [resetState, resetAction, resetPending] = useActionState(
    resetClinicPassword,
    resetInitialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteClinic,
    deleteInitialState,
  );
  const [addState, addAction, addPending] = useActionState(
    addClinicLogin,
    addInitialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeClinicLogin,
    removeInitialState,
  );
  const { t, locale } = useTranslation();

  return (
    <li className="rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">
            {name}
          </p>
          <p className="mt-0.5 truncate text-[12.5px] text-secondary">
            {formatDate(createdAt, locale)}
            {phone ? ` · ${phone}` : ""}
          </p>
        </div>

        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!confirm(t.clinics.confirmDelete(name))) {
              e.preventDefault();
            }
          }}
          className="shrink-0"
        >
          <input type="hidden" name="clinicId" value={id} />
          <button
            type="submit"
            disabled={deletePending}
            className="rounded-lg border border-transparent px-3 py-1.5 text-[12.5px] font-semibold text-danger hover:bg-danger-wash disabled:opacity-60"
          >
            {deletePending ? t.clinics.deleting : t.clinics.delete}
          </button>
        </form>
      </div>

      <div className="mt-3 rounded-lg border border-border bg-background p-3">
        <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-secondary">
          {t.clinics.loginsTitle}
        </p>

        <ul className="flex flex-col gap-1.5">
          {logins.map((login) => (
            <li
              key={login.profileId}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate text-[13px] text-foreground">
                {login.email}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <form action={resetAction}>
                  <input type="hidden" name="profileId" value={login.profileId} />
                  <button
                    type="submit"
                    disabled={resetPending}
                    className="rounded-lg border border-border-strong bg-surface px-2.5 py-1 text-[12px] font-semibold text-foreground hover:bg-surface-muted disabled:opacity-60"
                  >
                    {resetPending ? t.clinics.resetting : t.clinics.resetPassword}
                  </button>
                </form>
                {logins.length > 1 && (
                  <form
                    action={removeAction}
                    onSubmit={(e) => {
                      if (!confirm(t.clinics.confirmRemoveLogin(login.email))) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input
                      type="hidden"
                      name="profileId"
                      value={login.profileId}
                    />
                    <button
                      type="submit"
                      disabled={removePending}
                      className="rounded-lg border border-transparent px-2.5 py-1 text-[12px] font-semibold text-danger hover:bg-danger-wash disabled:opacity-60"
                    >
                      {removePending ? t.clinics.removing : t.clinics.removeLogin}
                    </button>
                  </form>
                )}
              </span>
            </li>
          ))}
        </ul>

        <form
          action={addAction}
          className="mt-2.5 flex flex-wrap items-center gap-2"
          key={addState.success?.email ?? "add-login"}
        >
          <input type="hidden" name="clinicId" value={id} />
          <input
            type="email"
            name="email"
            required
            placeholder={t.clinics.newLoginEmailPlaceholder}
            className="min-w-[180px] flex-1 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
          />
          <button
            type="submit"
            disabled={addPending}
            className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {addPending ? t.clinics.adding : t.clinics.addLogin}
          </button>
        </form>
      </div>

      {(resetState.error || deleteState.error || addState.error || removeState.error) && (
        <p className="mt-2.5 rounded-lg bg-danger-wash px-3 py-2 text-[13px] text-danger">
          {resetState.error ||
            deleteState.error ||
            addState.error ||
            removeState.error}
        </p>
      )}

      {resetState.success && (
        <CopyableCredentials
          email={resetState.success.email}
          password={resetState.success.password}
          title={t.clinics.newPasswordSet}
        />
      )}

      {addState.success && (
        <CopyableCredentials
          email={addState.success.email}
          password={addState.success.password}
          title={t.clinics.newLoginCreated}
        />
      )}
    </li>
  );
}
