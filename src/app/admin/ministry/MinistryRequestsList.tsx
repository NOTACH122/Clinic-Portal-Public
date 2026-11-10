"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { deleteMinistrySubmissions } from "./actions";
import MinistryRequestRow, { type MinistryRequest } from "./MinistryRequestRow";

export default function MinistryRequestsList({
  requests,
}: {
  requests: MinistryRequest[];
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const result = await deleteMinistrySubmissions([...selectedIds]);
    setDeleting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSelectedIds(new Set());
    router.refresh();
  }

  if (requests.length === 0) {
    return <p className="text-[13.5px] text-secondary">{t.ministry.noRequests}</p>;
  }

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
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

      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <MinistryRequestRow
            key={r.id}
            request={r}
            selected={selectedIds.has(r.id)}
            onToggleSelect={() => toggle(r.id)}
          />
        ))}
      </ul>
    </div>
  );
}
