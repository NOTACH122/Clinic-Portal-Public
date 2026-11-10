"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import {
  createMinistrySubmission,
  prepareMinistryEmail,
  acknowledgeMinistryDecline,
} from "./ministryActions";
import type { FileRow } from "@/components/FilesList";

export type MinistrySubmissionRow = {
  id: string;
  created_at: string;
  approved_at: string | null;
  final_document_added_at: string | null;
  clinic_notified_at: string | null;
  declined_at: string | null;
  declined_reason: string | null;
  decline_seen_at: string | null;
  fileCount: number;
};

const UNGROUPED = "__ungrouped__";

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

export default function MinistryPanel({
  files,
  submissions,
}: {
  files: FileRow[];
  submissions: MinistrySubmissionRow[];
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [zipPromptSubmissionId, setZipPromptSubmissionId] = useState<string | null>(
    null,
  );
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Only shown until the clinic opens Gmail for it once - after that,
  // relaunching happens from the request list below instead.
  const unnotifiedReadySubmissions = submissions.filter(
    (s) => s.approved_at && s.final_document_added_at && !s.clinic_notified_at,
  );

  const unseenDeclinedSubmissions = submissions.filter(
    (s) => s.declined_at && !s.decline_seen_at,
  );

  const folderNames = [
    ...new Set(files.map((f) => f.folder).filter((f): f is string => Boolean(f))),
  ].sort();
  const ungrouped = files.filter((f) => !f.folder);
  const groupedKeys = [
    ...folderNames,
    ...(ungrouped.length ? [UNGROUPED] : []),
  ];

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function folderFiles(key: string) {
    return key === UNGROUPED ? ungrouped : files.filter((f) => f.folder === key);
  }

  function isFolderFullySelected(key: string) {
    const group = folderFiles(key);
    return group.length > 0 && group.every((f) => selectedIds.has(f.id));
  }

  function toggleFolder(key: string) {
    const group = folderFiles(key);
    const allSelected = isFolderFullySelected(key);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const f of group) {
        if (allSelected) next.delete(f.id);
        else next.add(f.id);
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) {
      setError(t.ministry.selectAtLeastOne);
      return;
    }
    setError(null);
    setSuccessMsg(null);
    setSubmitting(true);

    const result = await createMinistrySubmission([...selectedIds]);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSelectedIds(new Set());
    setSuccessMsg(t.ministry.submissionCreated);
    router.refresh();
  }

  function requestOpenInGmail(submissionId: string) {
    const submission = submissions.find((s) => s.id === submissionId);
    // 1-2 files isn't worth asking about - just send them separately.
    if (submission && submission.fileCount <= 2) {
      handleOpenInGmail(submissionId, "separate");
      return;
    }
    setZipPromptSubmissionId(submissionId);
  }

  async function handleOpenInGmail(submissionId: string, mode: "zip" | "separate") {
    setZipPromptSubmissionId(null);
    setError(null);
    setOpeningId(submissionId);
    const result = await prepareMinistryEmail(submissionId, mode);
    setOpeningId(null);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.mailtoUrl) {
      window.open(result.mailtoUrl, "_blank");
    }
    router.refresh();
  }

  async function handleAcknowledgeDecline(submissionId: string) {
    setAcknowledgingId(submissionId);
    await acknowledgeMinistryDecline(submissionId);
    setAcknowledgingId(null);
    router.refresh();
  }

  function statusLabel(s: MinistrySubmissionRow) {
    if (s.declined_at) return t.ministry.statusDeclined;
    if (s.approved_at && s.final_document_added_at) return t.ministry.statusReady;
    if (s.approved_at) return t.ministry.statusApproved;
    return t.ministry.statusPending;
  }

  function statusColorClasses(s: MinistrySubmissionRow) {
    if (s.declined_at) return "bg-danger-wash text-danger";
    if (s.approved_at) return "bg-accent-wash text-accent-dark";
    return "bg-surface-muted text-secondary";
  }

  return (
    <div className="space-y-6">
      {unnotifiedReadySubmissions.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-accent bg-accent-wash p-4"
        >
          <p className="text-[14px] font-bold text-accent-dark">
            {t.ministry.readyBannerTitle}
          </p>
          <p className="mt-1 text-[13px] text-accent-dark">
            {t.ministry.readyBannerBody}
          </p>
          <button
            type="button"
            disabled={openingId === s.id}
            onClick={() => requestOpenInGmail(s.id)}
            className="mt-3 rounded-lg bg-accent px-4 py-2 text-[13.5px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {openingId === s.id ? t.ministry.preparingEmail : t.ministry.openInGmail}
          </button>
        </div>
      ))}

      {unseenDeclinedSubmissions.map((s) => (
        <div
          key={s.id}
          className="rounded-xl border border-danger bg-danger-wash p-4"
        >
          <p className="text-[14px] font-bold text-danger">
            {t.ministry.declinedBannerTitle}
          </p>
          {s.declined_reason && (
            <p className="mt-1 text-[13px] text-danger">{s.declined_reason}</p>
          )}
          <button
            type="button"
            disabled={acknowledgingId === s.id}
            onClick={() => handleAcknowledgeDecline(s.id)}
            className="mt-3 rounded-lg bg-danger px-4 py-2 text-[13.5px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.ministry.understood}
          </button>
        </div>
      ))}

      <div>
        <h3 className="mb-3 text-[14px] font-bold text-foreground">
          {t.ministry.selectFilesTitle}
        </h3>

        {files.length === 0 ? (
          <p className="text-[13.5px] text-secondary">{t.files.noFilesYet}</p>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              {groupedKeys.map((key) => (
                <div key={key}>
                  <div className="mb-2 flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isFolderFullySelected(key)}
                      onChange={() => toggleFolder(key)}
                      aria-label={t.ministry.selectFolder}
                      className="h-4 w-4 shrink-0 accent-accent"
                    />
                    <h4 className="text-[12.5px] font-semibold uppercase tracking-wide text-secondary">
                      {key === UNGROUPED ? t.dashboard.generalFiles : key}
                    </h4>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {folderFiles(key).map((file) => (
                      <li
                        key={file.id}
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(file.id)}
                          onChange={() => toggle(file.id)}
                          aria-label={file.filename}
                          className="h-4 w-4 shrink-0 accent-accent"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-foreground">
                            {file.filename}
                          </p>
                          <p className="text-[12px] text-secondary">
                            {formatDate(file.uploaded_at, locale)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="mt-3 rounded-lg bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? t.ministry.submitting : t.ministry.submitToMinistry}
            </button>
          </>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
            {error}
          </p>
        )}
        {successMsg && (
          <p className="mt-3 rounded-lg bg-accent-wash px-3.5 py-2.5 text-[13.5px] text-accent-dark">
            {successMsg}
          </p>
        )}
      </div>

      {submissions.length > 0 && (
        <div>
          <h3 className="mb-3 text-[14px] font-bold text-foreground">
            {t.ministry.yourRequestsTitle}
          </h3>
          <ul className="flex flex-col gap-2">
            {submissions.map((s) => {
              const ready = Boolean(s.approved_at && s.final_document_added_at);
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface p-3"
                >
                  <div>
                    <p className="text-[13.5px] font-semibold text-foreground">
                      {t.ministry.filesInRequest(s.fileCount)}
                    </p>
                    <p className="text-[12px] text-secondary">
                      {formatDate(s.created_at, locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusColorClasses(s)}`}
                    >
                      {statusLabel(s)}
                    </span>
                    {ready && (
                      <button
                        type="button"
                        disabled={openingId === s.id}
                        onClick={() => requestOpenInGmail(s.id)}
                        className="rounded-lg border border-accent bg-accent-wash px-3 py-1.5 text-[12.5px] font-bold text-accent-dark hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {openingId === s.id
                          ? t.ministry.preparingEmail
                          : s.clinic_notified_at
                            ? t.ministry.relaunch
                            : t.ministry.openInGmail}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {zipPromptSubmissionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
            <p className="mb-4 text-[14px] font-bold text-foreground">
              {t.ministry.sendChoiceTitle}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleOpenInGmail(zipPromptSubmissionId, "zip")}
                className="rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-accent-dark"
              >
                {t.ministry.sendAsZip}
              </button>
              <button
                type="button"
                onClick={() => handleOpenInGmail(zipPromptSubmissionId, "separate")}
                className="rounded-lg border border-border-strong bg-background px-4 py-2.5 text-[13.5px] font-semibold text-foreground hover:bg-surface-muted"
              >
                {t.ministry.sendSeparately}
              </button>
              <button
                type="button"
                onClick={() => setZipPromptSubmissionId(null)}
                className="mt-1 text-[12.5px] font-semibold text-secondary hover:text-foreground"
              >
                {t.ministry.cancelChoice}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
