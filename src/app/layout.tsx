import type { Metadata } from "next";
import { Noto_Sans_Georgian, Noto_Sans } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n/getLocale";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

// Two faces stacked to cover all three UI languages: Noto Sans Georgian
// has no Cyrillic glyphs, so Russian text falls through to Noto Sans for
// that script. Both are the same Noto design, so Latin text looks the
// same regardless of which one resolves it.
const radiGeorgian = Noto_Sans_Georgian({
  variable: "--font-radi-georgian",
  subsets: ["georgian", "latin"],
  weight: ["400", "500", "600", "700"],
});

const radiCyrillic = Noto_Sans({
  variable: "--font-radi-cyrillic",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Radi - კლინიკები",
  description: "Radi - კლინიკები",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${radiGeorgian.variable} ${radiCyrillic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider locale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
