"use client";

import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function SelectAllToggle({
  total,
  selectedCount,
  onChange,
}: {
  total: number;
  selectedCount: number;
  onChange: (selectAll: boolean) => void;
}) {
  const { t } = useTranslation();
  const allSelected = total > 0 && selectedCount === total;

  return (
    <label className="flex w-fit items-center gap-2.5 text-[13px] font-semibold text-secondary">
      <input
        type="checkbox"
        checked={allSelected}
        // Partially-selected lists get the dash state rather than an empty
        // box, so it's clear a click will select the rest.
        ref={(el) => {
          if (el) el.indeterminate = selectedCount > 0 && !allSelected;
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-accent"
      />
      {t.admin.selectAll}
    </label>
  );
}
