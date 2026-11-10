"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { deleteFiles } from "@/app/admin/actions";
import FileListItem from "./FileListItem";
import SelectAllToggle from "./SelectAllToggle";

export type FileRow = {
  id: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  note: string | null;
  clinic_name?: string;
  uploadedByClinic?: boolean;
  folder?: string | null;
  protocol_date?: string | null;
  validity_months?: number | null;
  expiry_acknowledged_at?: string | null;
};

export default function FilesList({
  files,
  showClinic = false,
  canDelete = false,
  canAcknowledgeExpiry = false,
}: {
  files: FileRow[];
  showClinic?: boolean;
  canDelete?: boolean;
  canAcknowledgeExpiry?: boolean;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (files.length === 0) {
    return <p className="text-[13.5px] text-secondary">{t.files.noFilesYet}</p>;
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSelected() {
    if (!confirm(t.admin.confirmDeleteSelected(selectedIds.size))) return;
    setError(null);
    setDeleting(true);
    const result = await deleteFiles([...selectedIds]);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSelectedIds(new Set());
    router.refresh();
  }

  function toggleSelectAll(selectAll: boolean) {
    setSelectedIds(selectAll ? new Set(files.map((f) => f.id)) : new Set());
  }

  return (
    <div className="space-y-3.5">
      {canDelete && (
        <SelectAllToggle
          total={files.length}
          selectedCount={selectedIds.size}
          onChange={toggleSelectAll}
        />
      )}

      {canDelete && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent bg-accent-wash p-3">
          <span className="text-[13px] font-semibold text-accent-dark">
            {t.admin.selected(selectedIds.size)}
          </span>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDeleteSelected}
            className="rounded-lg bg-danger px-3 py-1.5 text-[13px] font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {deleting ? t.files.deleting : t.admin.deleteSelected}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-[13px] font-semibold text-secondary hover:text-foreground"
          >
            {t.admin.clearSelection}
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-danger-wash px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2.5">
        {files.map((file) => (
          <FileListItem
            key={file.id}
            file={file}
            showClinic={showClinic}
            canDelete={canDelete}
            selectable={canDelete}
            selected={selectedIds.has(file.id)}
            onToggleSelect={() => toggle(file.id)}
            canAcknowledgeExpiry={canAcknowledgeExpiry}
          />
        ))}
      </ul>
    </div>
  );
}
