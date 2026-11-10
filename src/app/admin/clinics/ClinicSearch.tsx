"use client";

import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function ClinicSearch({ search }: { search: string }) {
  const { t } = useTranslation();

  return (
    <form method="GET" className="flex items-center gap-2">
      <input
        type="search"
        name="q"
        defaultValue={search}
        placeholder={t.clinics.searchPlaceholder}
        className="rounded-lg border border-border-strong bg-background px-3 py-1.5 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
      />
      <button
        type="submit"
        className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-surface-muted"
      >
        {t.clinics.search}
      </button>
    </form>
  );
}
