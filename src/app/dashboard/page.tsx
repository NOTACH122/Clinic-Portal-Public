import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/SignOutButton";
import LanguageToggle from "@/components/LanguageToggle";
import Logo from "@/components/Logo";
import { type FileRow } from "@/components/FilesList";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import UploadFileForm from "./UploadFileForm";
import ClinicFolderView from "./ClinicFolderView";
import PortalUploadSection from "./PortalUploadSection";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

export default async function DashboardPage() {
  const supabase = await createClient();
  const t = getDictionary(await getLocale());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  if (!profile?.clinic_id) {
    redirect("/login");
  }

  const clinicId = profile.clinic_id;

  // Explicitly scoped to our own clinic - RLS already enforces this,
  // but we never rely on that alone.
  const { data: filesData } = await supabase
    .from("files")
    .select(
      "id, filename, storage_path, uploaded_at, note, uploaded_by, folder, protocol_date, validity_months, expiry_acknowledged_at",
    )
    .eq("clinic_id", clinicId)
    .order("uploaded_at", { ascending: false });

  const files: FileRow[] = (filesData ?? []).map((f) => ({
    ...f,
    uploadedByClinic: f.uploaded_by === user.id,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-8">
        <Logo size={30} withWordmark />
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <h1 className="mb-5 text-[19px] font-bold text-foreground">
          {t.dashboard.title}
        </h1>

        <div className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">
            {t.dashboard.uploadFile}
          </h2>
          <UploadFileForm clinicId={clinicId} />
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <ClinicFolderView files={files} />
        </div>

        <PortalUploadSection />

        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">
            {t.dashboard.changePasswordTitle}
          </h2>
          <ChangePasswordForm />
        </div>
      </main>
    </div>
  );
}
