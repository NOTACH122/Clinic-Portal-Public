"use client";

import { createContext, useContext } from "react";
import { getDictionary, type Locale } from "./translations";

const LocaleContext = createContext<Locale>("ka");

export function LanguageProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useTranslation() {
  const locale = useContext(LocaleContext);
  return { locale, t: getDictionary(locale) };
}
