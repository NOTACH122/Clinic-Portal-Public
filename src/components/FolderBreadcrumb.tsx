"use client";

import { useTranslation } from "@/lib/i18n/LanguageContext";
import { folderSegments, FOLDER_SEPARATOR } from "@/lib/folderPath";

export default function FolderBreadcrumb({
  path,
  onNavigate,
}: {
  path: string | null;
  onNavigate: (path: string | null) => void;
}) {
  const { t } = useTranslation();
  const segments = folderSegments(path);

  return (
    <nav className="flex flex-wrap items-center gap-1 text-[13px]">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={
          segments.length === 0
            ? "font-bold text-foreground"
            : "font-semibold text-accent-dark hover:underline"
        }
      >
        {t.files.rootFolder}
      </button>
      {segments.map((segment, i) => {
        const target = segments.slice(0, i + 1).join(FOLDER_SEPARATOR);
        const isLast = i === segments.length - 1;
        return (
          <span key={target} className="flex items-center gap-1">
            <span className="text-secondary">/</span>
            <button
              type="button"
              onClick={() => onNavigate(target)}
              className={
                isLast
                  ? "font-bold text-foreground"
                  : "font-semibold text-accent-dark hover:underline"
              }
            >
              {segment}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
