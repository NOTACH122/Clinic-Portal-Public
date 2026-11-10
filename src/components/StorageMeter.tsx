"use client";

import { useTranslation } from "@/lib/i18n/LanguageContext";

// Cloudflare R2's free allowance.
export const R2_FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024;

const WARN_AT = 0.7;
const CRITICAL_AT = 0.9;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

export default function StorageMeter({ usedBytes }: { usedBytes: number }) {
  const { t } = useTranslation();
  const ratio = usedBytes / R2_FREE_TIER_BYTES;
  const percent = Math.min(100, ratio * 100);

  const level = ratio >= CRITICAL_AT ? "critical" : ratio >= WARN_AT ? "warn" : "ok";

  const barColor =
    level === "critical"
      ? "bg-danger"
      : level === "warn"
        ? "bg-[color:#f0b93a]"
        : "bg-accent";

  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-secondary">
          {t.admin.storageUsage}
        </span>
        <span className="text-[12.5px] font-semibold text-foreground">
          {formatBytes(usedBytes)} / {formatBytes(R2_FREE_TIER_BYTES)}
          <span className="ml-1.5 font-normal text-secondary">
            ({percent < 1 ? "<1" : Math.round(percent)}%)
          </span>
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(percent, 1)}%` }}
        />
      </div>

      {level !== "ok" && (
        <p
          className={`mt-2 text-[12.5px] font-semibold ${
            level === "critical" ? "text-danger" : "text-[color:#8a6400]"
          }`}
        >
          {level === "critical"
            ? t.admin.storageCritical
            : t.admin.storageWarning}
        </p>
      )}
    </div>
  );
}
