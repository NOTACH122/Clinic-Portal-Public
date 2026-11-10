"use client";

import { useRef } from "react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Clinic = { id: string; name: string };

export default function ClinicFilter({
  clinics,
  selected,
  search,
  clinicQ,
}: {
  clinics: Clinic[];
  selected: string;
  search: string;
  clinicQ: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useTranslation();

  return (
    <form
      ref={formRef}
      method="GET"
      className="flex flex-wrap items-center gap-2"
    >
      <label htmlFor="clinic" className="text-[12.5px] font-semibold text-secondary">
        {t.admin.filterByClinic}
      </label>
      <select
        id="clinic"
        name="clinic"
        defaultValue={selected}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-lg border border-border-strong bg-background px-3 py-1.5 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
      >
        <option value="">{t.admin.allClinics}</option>
        {clinics.map((clinic) => (
          <option key={clinic.id} value={clinic.id}>
            {clinic.name}
          </option>
        ))}
      </select>

      <input
        type="search"
        name="clinicQ"
        list="clinic-name-suggestions"
        defaultValue={clinicQ}
        placeholder={t.admin.searchClinicPlaceholder}
        className="rounded-lg border border-border-strong bg-background px-3 py-1.5 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
      />
      <datalist id="clinic-name-suggestions">
        {clinics.map((clinic) => (
          <option key={clinic.id} value={clinic.name} />
        ))}
      </datalist>

      <input
        type="search"
        name="q"
        defaultValue={search}
        placeholder={t.admin.searchPlaceholder}
        className="rounded-lg border border-border-strong bg-background px-3 py-1.5 text-[13px] text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-wash"
      />
      <button
        type="submit"
        className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground hover:bg-surface-muted"
      >
        {t.admin.search}
      </button>
    </form>
  );
}
