"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createUploadTicket } from "@/app/actions/storage";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import FileInput from "@/components/FileInput";
import {
  approveMinistrySubmission,
  declineMinistrySubmission,
  attachFinalDocument,
  deleteMinistrySubmissions,
} from "./actions";

export type MinistryRequest = {
  id: string;
  clinicId: string;
  clinicName: string;
  createdAt: string;
  approvedAt: string | null;
  finalDocumentAddedAt: string | null;
  clinicNotifiedAt: string | null;
  declinedAt: string | null;
  declinedReason: string | null;
  filenames: string[];
  finalDocumentFilename: string | null;
};

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

export default function MinistryRequestRow({
  request,
  selected = false,
  onToggleSelect,
}: {
  request: MinistryRequest;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const [approving, setApproving] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [declining, setDeclining] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(t.ministry.confirmDeleteRequest)) return;
    setError(null);
    setDeleting(true);
    const result = await deleteMinistrySubmissions([request.id]);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleApprove() {
    setError(null);
    setApproving(true);
    const result = await approveMinistrySubmission(request.id);
    setApproving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleDecline() {
    setError(null);
    setDeclining(true);
    const result = await declineMinistrySubmission(request.id, declineReason);
    setDeclining(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setShowDeclineForm(false);
    router.refresh();
  }

  async function handleAttach() {
    if (!file) return;
    setError(null);
    setAttaching(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(t.admin.signedOutError);
      setAttaching(false);
      return;
    }

    const contentType = file.type || "application/octet-stream";
    const ticket = await createUploadTicket(request.clinicId, file.name, contentType);

    if (ticket.error || !ticket.uploadUrl || !ticket.storagePath) {
      setError(t.admin.uploadFailed(ticket.error ?? ""));
      setAttaching(false);
      return;
    }

    const uploaded = await fetch(ticket.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });

    if (!uploaded.ok) {
      setError(t.admin.uploadFailed(String(uploaded.status)));
      setAttaching(false);
      return;
    }

    const { data: fileRow, error: insertError } = await supabase
      .from("files")
      .insert({
        clinic_id: request.clinicId,
        filename: file.name,
        storage_path: ticket.storagePath,
        storage_provider: "r2",
        size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (insertError || !fileRow) {
      setError(t.admin.saveRecordFailed(insertError?.message ?? ""));
      setAttaching(false);
      return;
    }

    const result = await attachFinalDocument(request.id, fileRow.id);
    setAttaching(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setFile(null);
    router.refresh();
  }

  const status = request.declinedAt
    ? t.ministry.statusDeclined
    : request.approvedAt && request.finalDocumentAddedAt
      ? t.ministry.statusReady
      : request.approvedAt
        ? t.ministry.statusApproved
        : t.ministry.statusPending;

  const statusClasses = request.declinedAt
    ? "bg-danger-wash text-danger"
    : request.approvedAt
      ? "bg-accent-wash text-accent-dark"
      : "bg-surface-muted text-secondary";

  // Once the clinic has opened Gmail for a ready request at least once, gray
  // out the whole card so admin can tell "already sent" apart from "still
  // waiting on the clinic" when several ready requests are on screen at once.
  const cardClasses = request.clinicNotifiedAt
    ? "border-border bg-surface-muted"
    : "border-border bg-surface";

  const unresolved = !request.approvedAt && !request.declinedAt;

  return (
    <li className={`rounded-xl border p-4 ${cardClasses}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={t.ministry.submittedBy(request.clinicName)}
            className="mt-1 h-4 w-4 shrink-0 accent-accent"
          />
          <div>
          <p className="text-[14px] font-semibold text-foreground">
            {t.ministry.submittedBy(request.clinicName)}
          </p>
          <p className="text-[12.5px] text-secondary">
            {formatDate(request.createdAt, locale)} ·{" "}
            {t.ministry.filesInRequest(request.filenames.length)}
          </p>
          <p className="mt-1 text-[12.5px] text-secondary">
            {request.filenames.join(", ")}
          </p>
          {request.finalDocumentFilename && (
            <p className="mt-1 text-[12.5px] text-accent-dark">
              {t.ministry.finalDocumentLabel}: {request.finalDocumentFilename}
            </p>
          )}
          {request.declinedAt && request.declinedReason && (
            <p className="mt-1 text-[12.5px] text-danger">
              {request.declinedReason}
            </p>
          )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClasses}`}
          >
            {status}
          </span>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            aria-label={t.files.delete}
            title={t.files.delete}
            className="flex items-center rounded-lg border border-transparent p-1.5 text-danger hover:bg-danger-wash disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg
              width="15"
              height="15"
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
        </div>
      </div>

      {unresolved && !showDeclineForm && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={approving}
            onClick={handleApprove}
            className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {approving ? t.ministry.approving : t.ministry.approveButton}
          </button>
          <button
            type="button"
            onClick={() => setShowDeclineForm(true)}
            className="rounded-lg border border-danger bg-danger-wash px-3.5 py-2 text-[13px] font-bold text-danger hover:bg-danger hover:text-white"
          >
            {t.ministry.declineButton}
          </button>
        </div>
      )}

      {unresolved && showDeclineForm && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder={t.ministry.declineReasonPlaceholder}
            className="min-w-[200px] flex-1 rounded-lg border border-border-strong bg-background px-3 py-2 text-[13px] text-foreground focus:border-danger focus:outline-none focus:ring-2 focus:ring-danger-wash"
          />
          <button
            type="button"
            disabled={declining || !declineReason.trim()}
            onClick={handleDecline}
            className="rounded-lg bg-danger px-3.5 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {declining ? t.ministry.declining : t.ministry.confirmDecline}
          </button>
          <button
            type="button"
            onClick={() => setShowDeclineForm(false)}
            className="text-[12.5px] font-semibold text-secondary hover:text-foreground"
          >
            {t.ministry.cancelChoice}
          </button>
        </div>
      )}

      {request.approvedAt && !request.finalDocumentAddedAt && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <FileInput id={`final-doc-${request.id}`} file={file} onChange={setFile} />
          <button
            type="button"
            disabled={!file || attaching}
            onClick={handleAttach}
            className="rounded-lg bg-accent px-3.5 py-2 text-[13px] font-bold text-white hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {attaching ? t.ministry.attaching : t.ministry.attachButton}
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}
    </li>
  );
}
