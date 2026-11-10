"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createUploadTicket } from "@/app/actions/storage";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { VALIDITY_OPTIONS } from "@/lib/protocolExpiry";
import FileInput from "@/components/FileInput";

type Clinic = { id: string; name: string };

export default function UploadFileForm({ clinics }: { clinics: Clinic[] }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [clinicId, setClinicId] = useState(clinics[0]?.id ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [protocolDate, setProtocolDate] = useState("");
  const [validityMonths, setValidityMonths] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingDrop, setPendingDrop] = useState<File[] | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [perFileDates, setPerFileDates] = useState<
    { protocolDate: string; validityMonths: string }[]
  >([]);
  const [applyToAll, setApplyToAll] = useState(false);

  type UploadItem = { file: File; protocolDate: string; validityMonths: string };

  async function performUpload(items: UploadItem[]): Promise<boolean> {
    setError(null);

    if (!clinicId) {
      setError(t.admin.chooseClinicFirst);
      return false;
    }
    if (items.length === 0) {
      setError(t.admin.chooseFilesFirst);
      return false;
    }

    setUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t.admin.signedOutError);
      setUploading(false);
      return false;
    }

    const failures: string[] = [];

    for (const item of items) {
      // New uploads go to R2: the server authorizes and signs, the browser
      // PUTs the bytes straight there without passing through our server.
      const contentType = item.file.type || "application/octet-stream";
      const ticket = await createUploadTicket(clinicId, item.file.name, contentType);

      if (ticket.error || !ticket.uploadUrl || !ticket.storagePath) {
        failures.push(t.admin.uploadFailed(`${item.file.name}: ${ticket.error ?? ""}`));
        continue;
      }

      const uploaded = await fetch(ticket.uploadUrl, {
        method: "PUT",
        body: item.file,
        headers: { "Content-Type": contentType },
      });

      if (!uploaded.ok) {
        failures.push(t.admin.uploadFailed(`${item.file.name}: ${uploaded.status}`));
        continue;
      }

      const { error: insertError } = await supabase.from("files").insert({
        clinic_id: clinicId,
        filename: item.file.name,
        storage_path: ticket.storagePath,
        storage_provider: "r2",
        size_bytes: item.file.size,
        uploaded_by: user.id,
        note: note || null,
        protocol_date: item.protocolDate || null,
        validity_months: item.validityMonths ? Number(item.validityMonths) : null,
      });

      if (insertError) {
        failures.push(t.admin.saveRecordFailed(`${item.file.name}: ${insertError.message}`));
      }
    }

    setUploading(false);
    router.refresh();

    if (failures.length) {
      setError(failures.join(" "));
      return false;
    }

    setFiles([]);
    setNote("");
    setProtocolDate("");
    setValidityMonths("");
    return true;
  }

  async function uploadFiles(filesToUpload: File[]): Promise<boolean> {
    return performUpload(
      filesToUpload.map((file) => ({ file, protocolDate, validityMonths })),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await uploadFiles(files);
  }

  const selectedClinicName = clinics.find((c) => c.id === clinicId)?.name ?? "";

  function beginReview() {
    if (!pendingDrop) return;
    setPerFileDates(pendingDrop.map(() => ({ protocolDate, validityMonths })));
    setApplyToAll(false);
    setReviewIndex(0);
  }

  function cancelDrop() {
    setPendingDrop(null);
    setReviewIndex(null);
    setPerFileDates([]);
    setApplyToAll(false);
    setError(null);
  }

  function updateCurrentFileDate(field: "protocolDate" | "validityMonths", value: string) {
    if (reviewIndex === null) return;
    setPerFileDates((prev) =>
      prev.map((entry, i) =>
        applyToAll || i === reviewIndex ? { ...entry, [field]: value } : entry,
      ),
    );
  }

  // Copies the file currently on screen onto every other file, so a batch
  // that shares one protocol date doesn't have to be filled in one by one.
  function toggleApplyToAll(checked: boolean) {
    setApplyToAll(checked);
    if (!checked || reviewIndex === null) return;
    setPerFileDates((prev) => {
      const current = prev[reviewIndex];
      if (!current) return prev;
      return prev.map(() => ({ ...current }));
    });
  }

  async function finishReview() {
    if (!pendingDrop) return;
    const items: UploadItem[] = pendingDrop.map((file, i) => ({
      file,
      protocolDate: perFileDates[i]?.protocolDate ?? "",
      validityMonths: perFileDates[i]?.validityMonths ?? "",
    }));
    const success = await performUpload(items);
    if (success) {
      setPendingDrop(null);
      setReviewIndex(null);
      setPerFileDates([]);
      setApplyToAll(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.admin.clinic}
        </label>
        <select
          value={clinicId}
          onChange={(e) => setClinicId(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
        >
          {clinics.map((clinic) => (
            <option key={clinic.id} value={clinic.id}>
              {clinic.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.admin.file}
        </label>
        <FileInput
          id="admin-file-input"
          multiple
          files={files}
          onChange={setFiles}
          onFilesDropped={setPendingDrop}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.admin.note}
        </label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
            {t.admin.protocolDate}
          </label>
          <input
            type="date"
            value={protocolDate}
            onChange={(e) => setProtocolDate(e.target.value)}
            className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
            {t.admin.validityPeriod}
          </label>
          <select
            value={validityMonths}
            onChange={(e) => setValidityMonths(e.target.value)}
            className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
          >
            <option value="">{t.admin.validityNone}</option>
            {VALIDITY_OPTIONS.map((option) => (
              <option key={option.months} value={option.months}>
                {t.admin[option.labelKey]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading || clinics.length === 0}
        className="rounded-lg bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? t.admin.uploading : t.admin.uploadButton}
      </button>
      {clinics.length === 0 && (
        <p className="text-[13px] text-secondary">{t.admin.addClinicFirst}</p>
      )}
      </form>

      {pendingDrop && reviewIndex === null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl">
            <h2 className="mb-3 text-[15px] font-bold text-foreground">
              {t.admin.confirmUploadTitle}
            </h2>
            <dl className="mb-4 space-y-2 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-secondary">{t.admin.clinic}</dt>
                <dd className="text-right font-medium text-foreground">
                  {selectedClinicName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-secondary">{t.admin.file}</dt>
                <dd className="text-right font-medium text-foreground">
                  <ul>
                    {pendingDrop.map((file, i) => (
                      <li key={i} className="break-all">
                        {file.name}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              {note && (
                <div className="flex justify-between gap-3">
                  <dt className="text-secondary">{t.admin.note}</dt>
                  <dd className="text-right font-medium text-foreground">{note}</dd>
                </div>
              )}
            </dl>

            {error && (
              <p className="mb-3 rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={cancelDrop}
                disabled={uploading}
                className="rounded-lg border border-border-strong px-4 py-2 text-[14px] font-semibold text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.admin.no}
              </button>
              <button
                type="button"
                onClick={beginReview}
                disabled={uploading}
                className="rounded-lg bg-accent px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.admin.yes}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDrop && reviewIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-surface p-5 shadow-xl">
            <h2 className="mb-1 text-[15px] font-bold text-foreground">
              {pendingDrop[reviewIndex].name}
            </h2>
            <p className="mb-3 text-[12.5px] text-secondary">
              {t.admin.fileProgress(reviewIndex + 1, pendingDrop.length)}
            </p>

            <div className="mb-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
                  {t.admin.protocolDate}
                </label>
                <input
                  type="date"
                  value={perFileDates[reviewIndex]?.protocolDate ?? ""}
                  onChange={(e) => updateCurrentFileDate("protocolDate", e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
                  {t.admin.validityPeriod}
                </label>
                <select
                  value={perFileDates[reviewIndex]?.validityMonths ?? ""}
                  onChange={(e) => updateCurrentFileDate("validityMonths", e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-background px-3.5 py-2.5 text-[14.5px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
                >
                  <option value="">{t.admin.validityNone}</option>
                  {VALIDITY_OPTIONS.map((option) => (
                    <option key={option.months} value={option.months}>
                      {t.admin[option.labelKey]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {pendingDrop.length > 1 && (
              <label className="mb-4 flex items-center gap-2 text-[13px] text-secondary">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(e) => toggleApplyToAll(e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
                {t.admin.applyToAll}
              </label>
            )}

            {error && (
              <p className="mb-3 rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
                {error}
              </p>
            )}

            <div className="flex justify-between gap-2.5">
              <button
                type="button"
                onClick={cancelDrop}
                disabled={uploading}
                className="rounded-lg border border-border-strong px-4 py-2 text-[14px] font-semibold text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.admin.no}
              </button>
              <div className="flex gap-2.5">
                {reviewIndex > 0 && !applyToAll && (
                  <button
                    type="button"
                    onClick={() => setReviewIndex((i) => (i ?? 1) - 1)}
                    disabled={uploading}
                    className="rounded-lg border border-border-strong px-4 py-2 text-[14px] font-semibold text-secondary transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t.admin.back}
                  </button>
                )}
                {!applyToAll && reviewIndex < pendingDrop.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setReviewIndex((i) => (i ?? 0) + 1)}
                    disabled={uploading}
                    className="rounded-lg bg-accent px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t.admin.next}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={finishReview}
                    disabled={uploading}
                    className="rounded-lg bg-accent px-4 py-2 text-[14px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploading ? t.admin.uploading : t.admin.uploadButton}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
