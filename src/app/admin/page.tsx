import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SignOutButton from "@/components/SignOutButton";
import LanguageToggle from "@/components/LanguageToggle";
import Logo from "@/components/Logo";
import UploadFileForm from "./UploadFileForm";
import ClinicFilter from "./ClinicFilter";
import AdminClinicFolderView from "./AdminClinicFolderView";
import FilesList, { type FileRow } from "@/components/FilesList";
import StorageMeter from "@/components/StorageMeter";
import FilesPagination from "./FilesPagination";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

const PAGE_SIZE = 50;
// Stands in for "no clinic matched", so the query returns nothing instead of
// silently ignoring the filter.
const NO_MATCH_ID = "00000000-0000-0000-0000-000000000000";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    clinic?: string;
    q?: string;
    clinicQ?: string;
    page?: string;
  }>;
}) {
  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();
  const t = getDictionary(await getLocale());

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const {
    clinic: selectedClinic = "",
    q: search = "",
    clinicQ = "",
    page: pageParam = "",
  } = await searchParams;

  const page = Math.max(1, Number(pageParam) || 1);

  // Profile and clinics first: the clinic-name search needs the clinic list
  // to turn a name fragment into ids, and the role check gates the rest.
  const [{ data: profile }, { data: clinics }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase.from("clinics").select("id, name").order("name"),
  ]);

  if (profile?.role !== "admin") {
    redirect("/dashboard");
  }

  let filesQuery = supabase
    .from("files")
    .select(
      "id, filename, storage_path, uploaded_at, note, uploaded_by, folder, protocol_date, validity_months, expiry_acknowledged_at, clinics(name)",
      { count: "exact" },
    )
    .order("uploaded_at", { ascending: false });

  if (selectedClinic) {
    filesQuery = filesQuery.eq("clinic_id", selectedClinic);
  }
  if (search) {
    filesQuery = filesQuery.ilike("filename", `%${search}%`);
  }
  if (clinicQ) {
    // Filtered in the database rather than in memory, so that paging over
    // the results stays correct.
    const matchingIds = (clinics ?? [])
      .filter((c) => c.name.toLowerCase().includes(clinicQ.toLowerCase()))
      .map((c) => c.id);
    filesQuery = filesQuery.in(
      "clinic_id",
      matchingIds.length ? matchingIds : [NO_MATCH_ID],
    );
  }

  // Picking a clinic switches to the folder browser, which needs that
  // clinic's whole file list to build the folder tree - bounded by one
  // clinic. The flat all-files list is not bounded by anything, so it pages.
  if (!selectedClinic) {
    filesQuery = filesQuery.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  }

  // These four reads are fully independent of one another (the role check
  // only gates a redirect below - middleware already keeps non-admins out
  // of this route, so this is a cheap defense-in-depth check, not a real
  // gate) - batching them removes ~4 sequential round trips from TTFB.
  const [
    { data: filesData, count: totalFiles },
    { count: pendingMinistryCount },
    { data: storedSizes },
  ] = await Promise.all([
    filesQuery,
    supabaseAdmin
      .from("ministry_submissions")
      .select("id", { count: "exact", head: true })
      .is("final_document_added_at", null)
      .is("declined_at", null),
    // Summed from our own records rather than listing the bucket, so the
    // usage meter costs one indexed read instead of paging every object.
    supabaseAdmin
      .from("files")
      .select("size_bytes")
      .eq("storage_provider", "r2"),
  ]);

  const usedBytes = (storedSizes ?? []).reduce(
    (total, row) => total + (row.size_bytes ?? 0),
    0,
  );

  const filteredFilesData = filesData ?? [];

  const uploaderIds = [
    ...new Set(filteredFilesData.map((f) => f.uploaded_by).filter(Boolean)),
  ];
  const uploaderRoleById = new Map<string, string>();
  if (uploaderIds.length) {
    const { data: uploaderProfiles } = await supabase
      .from("profiles")
      .select("id, role")
      .in("id", uploaderIds);
    for (const p of uploaderProfiles ?? []) {
      uploaderRoleById.set(p.id, p.role);
    }
  }

  const files: FileRow[] = filteredFilesData.map((f) => ({
    id: f.id,
    filename: f.filename,
    storage_path: f.storage_path,
    uploaded_at: f.uploaded_at,
    note: f.note,
    clinic_name: (f.clinics as unknown as { name: string } | null)?.name,
    uploadedByClinic: uploaderRoleById.get(f.uploaded_by) === "clinic",
    folder: f.folder,
    protocol_date: f.protocol_date,
    validity_months: f.validity_months,
    expiry_acknowledged_at: f.expiry_acknowledged_at,
  }));

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Logo size={30} withWordmark />
          <Link
            href="/admin/clinics"
            className="text-[13px] font-semibold text-accent-dark hover:underline"
          >
            {t.admin.manageClinics}
          </Link>
          <Link
            href="/admin/ministry"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-accent-dark hover:underline"
          >
            {t.ministry.navLink}
            {!!pendingMinistryCount && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                {t.ministry.pendingBadge(pendingMinistryCount)}
              </span>
            )}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <h1 className="mb-5 text-[19px] font-bold text-foreground">
          {t.admin.dashboardTitle}
        </h1>

        <div className="mb-6">
          <StorageMeter usedBytes={usedBytes} />
        </div>

        <div className="mb-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="mb-4 text-[15px] font-bold text-foreground">
            {t.admin.uploadFile}
          </h2>
          <UploadFileForm clinics={clinics ?? []} />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold text-foreground">
              {t.admin.allFiles}
            </h2>
            <ClinicFilter
              clinics={clinics ?? []}
              selected={selectedClinic}
              search={search}
              clinicQ={clinicQ}
            />
          </div>
          {selectedClinic ? (
            <AdminClinicFolderView files={files} />
          ) : (
            <>
              <FilesList files={files} showClinic canDelete />
              <FilesPagination
                page={page}
                pageSize={PAGE_SIZE}
                total={totalFiles ?? 0}
                clinic={selectedClinic}
                q={search}
                clinicQ={clinicQ}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
