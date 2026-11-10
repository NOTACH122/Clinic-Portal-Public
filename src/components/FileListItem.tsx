"use client";

import { useActionState, useState } from "react";
import { createDownloadUrl } from "@/app/actions/storage";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { deleteFile, type DeleteFileState } from "@/app/admin/actions";
import { isProtocolExpired } from "@/lib/protocolExpiry";
import {
  acknowledgeExpiry,
  type AcknowledgeExpiryState,
} from "@/app/dashboard/expiryActions";
import type { FileRow } from "./FilesList";

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

const deleteInitialState: DeleteFileState = {};
const acknowledgeInitialState: AcknowledgeExpiryState = {};

export default function FileListItem({
  file,
  showClinic,
  canDelete,
  selectable = false,
  selected = false,
  onToggleSelect,
  canAcknowledgeExpiry = false,
}: {
  file: FileRow;
  showClinic: boolean;
  canDelete: boolean;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  canAcknowledgeExpiry?: boolean;
}) {
  const { t, locale } = useTranslation();
  const expired = isProtocolExpired(file.protocol_date, file.validity_months);
  // Once the clinic has acknowledged it, the row stays flagged but drops
  // from red to a calmer amber - for the clinic only. Admins keep seeing
  // red, since an expired protocol still needs chasing whether or not the
  // clinic has ticked it off.
  const acknowledged =
    Boolean(file.expiry_acknowledged_at) && canAcknowledgeExpiry;
  const [acknowledgeState, acknowledgeAction, acknowledgePending] =
    useActionState(acknowledgeExpiry, acknowledgeInitialState);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteFile,
    deleteInitialState,
  );

  async function handleDownload() {
    setDownloadError(null);
    setDownloading(true);

    // Signed on the server so access is checked before a URL exists, and so
    // the file can come from either storage backend transparently.
    const { url, error: signError } = await createDownloadUrl(file.id);

    setDownloading(false);

    if (signError || !url) {
      setDownloadError(t.files.downloadFailed(file.filename, signError ?? ""));
      return;
    }

    window.open(url, "_blank");
  }

  return (
    <li
      className={`rounded-xl border p-3.5 ${
        expired
          ? acknowledged
            ? "border-warn bg-warn-wash"
            : "border-danger bg-danger-wash"
          : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center gap-3.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={file.filename}
            className="h-4 w-4 shrink-0 accent-accent"
          />
        )}
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            file.uploadedByClinic
              ? "bg-info-wash text-info-dark"
              : "bg-accent-wash text-accent-dark"
          }`}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-[14px] font-semibold text-foreground">
              {file.filename}
            </p>
            {expired && (
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                  acknowledged ? "bg-warn" : "bg-danger"
                }`}
              >
                {t.files.protocolExpired}
              </span>
            )}
            {expired && !acknowledged && canAcknowledgeExpiry && (
              <form action={acknowledgeAction} className="shrink-0">
                <input type="hidden" name="fileId" value={file.id} />
                <button
                  type="submit"
                  disabled={acknowledgePending}
                  className="rounded-full border border-danger px-2.5 py-0.5 text-[11px] font-bold text-danger hover:bg-danger hover:text-white disabled:opacity-60"
                >
                  {acknowledgePending
                    ? t.files.acknowledging
                    : t.files.acknowledgeExpiry}
                </button>
              </form>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-secondary">
            {showClinic && file.clinic_name ? `${file.clinic_name} · ` : ""}
            {formatDate(file.uploaded_at, locale)}
            {file.note ? ` · ${file.note}` : ""}
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-transparent bg-accent-wash px-3 py-2 text-[12.5px] font-semibold text-accent-dark hover:border-accent disabled:opacity-60"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span className="hidden sm:inline">
            {downloading ? t.files.preparing : t.files.download}
          </span>
        </button>

        {canDelete && (
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(t.files.confirmDelete(file.filename))) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="fileId" value={file.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="flex shrink-0 items-center rounded-lg border border-transparent px-2.5 py-2 text-[12.5px] font-semibold text-danger hover:bg-danger-wash disabled:opacity-60"
              aria-label={t.files.delete}
              title={t.files.delete}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </form>
        )}
      </div>

      {downloadError && (
        <p className="mt-2.5 rounded-lg bg-danger-wash px-3 py-2 text-[13px] text-danger">
          {downloadError}
        </p>
      )}
      {acknowledgeState.error && (
        <p className="mt-2.5 rounded-lg bg-danger-wash px-3 py-2 text-[13px] text-danger">
          {acknowledgeState.error}
        </p>
      )}

      {deleteState.error && (
        <p className="mt-2.5 rounded-lg bg-danger-wash px-3 py-2 text-[13px] text-danger">
          {deleteState.error}
        </p>
      )}
    </li>
  );
}
