"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createUploadTicket } from "@/app/actions/storage";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import FileInput from "@/components/FileInput";

const MAX_UPLOAD_BYTES = 2.5 * 1024 * 1024;
const MAX_UPLOAD_MB = 2.5;

export default function UploadFileForm({ clinicId }: { clinicId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(selected: File | null) {
    if (selected && selected.size > MAX_UPLOAD_BYTES) {
      setError(t.dashboard.fileTooLarge(MAX_UPLOAD_MB));
      setFile(null);
      return;
    }
    setError(null);
    setFile(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError(t.admin.chooseFileFirst);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(t.dashboard.fileTooLarge(MAX_UPLOAD_MB));
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError(t.admin.signedOutError);
      setUploading(false);
      return;
    }

    const contentType = file.type || "application/octet-stream";
    const ticket = await createUploadTicket(clinicId, file.name, contentType);

    if (ticket.error || !ticket.uploadUrl || !ticket.storagePath) {
      setError(t.admin.uploadFailed(ticket.error ?? ""));
      setUploading(false);
      return;
    }

    const uploaded = await fetch(ticket.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });

    if (!uploaded.ok) {
      setError(t.admin.uploadFailed(String(uploaded.status)));
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("files").insert({
      clinic_id: clinicId,
      filename: file.name,
      storage_path: ticket.storagePath,
      storage_provider: "r2",
      size_bytes: file.size,
      uploaded_by: user.id,
      note: note || null,
    });

    if (insertError) {
      setError(t.admin.saveRecordFailed(insertError.message));
      setUploading(false);
      return;
    }

    setFile(null);
    setNote("");
    setUploading(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-secondary">
          {t.admin.file}
        </label>
        <FileInput
          id="dashboard-file-input"
          file={file}
          onChange={handleFileChange}
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

      {error && (
        <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading}
        className="rounded-lg bg-accent px-4 py-2.5 text-[14.5px] font-bold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? t.admin.uploading : t.admin.uploadButton}
      </button>
    </form>
  );
}
