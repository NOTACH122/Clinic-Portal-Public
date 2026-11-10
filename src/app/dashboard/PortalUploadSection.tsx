"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function PortalUploadSection() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface-muted opacity-70">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left cursor-not-allowed sm:px-6"
      >
        <h2 className="text-[15px] font-bold text-secondary">
          {t.ministry.submitToMinistry}
        </h2>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={`shrink-0 text-secondary transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border px-5 py-6 text-center sm:px-6">
          <p className="text-[13.5px] font-semibold text-secondary">
            {t.ministry.workInProgress}
          </p>
        </div>
      )}
    </div>
  );
}
