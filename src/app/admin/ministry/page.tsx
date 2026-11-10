import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LanguageToggle from "@/components/LanguageToggle";
import SignOutButton from "@/components/SignOutButton";
import Logo from "@/components/Logo";
import MinistryRequestsList from "./MinistryRequestsList";
import type { MinistryRequest } from "./MinistryRequestRow";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

export default async function AdminMinistryPage() {
  const supabase = await createClient();
  const t = getDictionary(await getLocale());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const supabaseAdmin = createAdminClient();

  const { data: submissionsData } = await supabaseAdmin
    .from("ministry_submissions")
    .select(
      "id, clinic_id, created_at, approved_at, final_document_added_at, clinic_notified_at, declined_at, declined_reason, clinics(name), ministry_submission_files(is_final_document, files(filename))",
    )
    .order("created_at", { ascending: false });

  const requests: MinistryRequest[] = (submissionsData ?? []).map((s) => {
    const clinicName = (s.clinics as unknown as { name: string } | null)?.name ?? "";
    const filesJoined = (s.ministry_submission_files ?? []) as unknown as {
      is_final_document: boolean;
      files: { filename: string } | null;
    }[];

    return {
      id: s.id,
      clinicId: s.clinic_id,
      clinicName,
      createdAt: s.created_at,
      approvedAt: s.approved_at,
      finalDocumentAddedAt: s.final_document_added_at,
      clinicNotifiedAt: s.clinic_notified_at,
      declinedAt: s.declined_at,
      declinedReason: s.declined_reason,
      filenames: filesJoined
        .filter((f) => !f.is_final_document)
        .map((f) => f.files?.filename ?? ""),
      finalDocumentFilename:
        filesJoined.find((f) => f.is_final_document)?.files?.filename ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Logo size={30} withWordmark />
          <Link
            href="/admin"
            className="text-[13px] font-semibold text-accent-dark hover:underline"
          >
            {t.ministry.backToAdmin}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <h1 className="mb-5 text-[19px] font-bold text-foreground">
          {t.ministry.pageTitle}
        </h1>

        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <MinistryRequestsList requests={requests} />
        </div>
      </main>
    </div>
  );
}
