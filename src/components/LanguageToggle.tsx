"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/translations";

export default function LanguageToggle() {
  const router = useRouter();
  const { locale } = useTranslation();

  // Language names are shown in their own script, not translated into the
  // current locale - the standard pattern for language switchers, since a
  // reader needs to recognize their language before they can read anything else.
  const options: { code: Locale; label: string }[] = [
    { code: "ka", label: "ქარ" },
    { code: "en", label: "EN" },
    { code: "ru", label: "RU" },
  ];

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const code = target.closest("button")?.dataset.code as Locale | undefined;
    if (!code || code === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${code}; path=/; max-age=31536000`;
    router.refresh();
  }

  return (
    <div
      onClick={handleClick}
      className="inline-flex items-center gap-0.5 rounded-full border border-border-strong bg-surface p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.code}
          data-code={option.code}
          aria-pressed={option.code === locale}
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            option.code === locale
              ? "bg-foreground text-background"
              : "text-secondary hover:bg-surface-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
