"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function FilesPagination({
  page,
  pageSize,
  total,
  clinic,
  q,
  clinicQ,
}: {
  page: number;
  pageSize: number;
  total: number;
  clinic: string;
  q: string;
  clinicQ: string;
}) {
  const { t } = useTranslation();

  if (total <= pageSize) return null;

  const lastPage = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    if (clinic) params.set("clinic", clinic);
    if (q) params.set("q", q);
    if (clinicQ) params.set("clinicQ", clinicQ);
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  const linkClass =
    "rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-muted";
  const disabledClass =
    "rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-semibold text-secondary opacity-50";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12.5px] text-secondary">
        {t.admin.pageRange(from, to, total)}
      </span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={linkClass}>
            {t.admin.back}
          </Link>
        ) : (
          <span className={disabledClass}>{t.admin.back}</span>
        )}
        {page < lastPage ? (
          <Link href={hrefFor(page + 1)} className={linkClass}>
            {t.admin.next}
          </Link>
        ) : (
          <span className={disabledClass}>{t.admin.next}</span>
        )}
      </div>
    </div>
  );
}
