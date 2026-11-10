"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export default function SignOutButton() {
  const router = useRouter();
  const { t } = useTranslation();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    document.cookie = "remembered=; path=/; max-age=0";
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-full border border-border-strong bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-foreground hover:bg-surface-muted"
    >
      {t.signOut}
    </button>
  );
}
