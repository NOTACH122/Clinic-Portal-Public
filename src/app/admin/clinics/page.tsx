import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AddClinicForm from "./AddClinicForm";
import ClinicRow from "./ClinicRow";
import ClinicSearch from "./ClinicSearch";
import LanguageToggle from "@/components/LanguageToggle";
import SignOutButton from "@/components/SignOutButton";
import Logo from "@/components/Logo";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

export default async function ClinicsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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

  const { q: search = "" } = await searchParams;

  let clinicsQuery = supabase
    .from("clinics")
    .select("id, name, created_at, phone")
    .order("created_at", { ascending: false });

  if (search) {
    clinicsQuery = clinicsQuery.ilike("name", `%${search}%`);
  }

  const { data: clinics } = await clinicsQuery;

  const { data: clinicProfiles } = await supabase
    .from("profiles")
    .select("id, clinic_id")
    .eq("role", "clinic");

  // A clinic can have several logins, so each one is collected rather than
  // the last one overwriting the rest.
  const loginsByClinicId = new Map<
    string,
    { profileId: string; email: string }[]
  >();

  if (clinicProfiles?.length) {
    const supabaseAdmin = createAdminClient();
    const { data: usersPage } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    const usersById = new Map(usersPage?.users.map((u) => [u.id, u]));

    for (const profile of clinicProfiles) {
      if (!profile.clinic_id) continue;
      const authUser = usersById.get(profile.id);
      if (!authUser?.email) continue;

      const existing = loginsByClinicId.get(profile.clinic_id) ?? [];
      existing.push({ profileId: profile.id, email: authUser.email });
      loginsByClinicId.set(profile.clinic_id, existing);
    }

    for (const logins of loginsByClinicId.values()) {
      logins.sort((a, b) => a.email.localeCompare(b.email));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-8">
        <div className="flex items-center gap-4">
          <Logo size={30} withWordmark />
          <Link
            href="/admin"
            className="text-[13px] font-semibold text-accent-dark hover:underline"
          >
            {t.clinics.backToAdmin}
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <SignOutButton />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-8">
        <h1 className="mb-5 text-[19px] font-bold text-foreground">
          {t.clinics.title}
        </h1>

        <div className="mb-6">
          <AddClinicForm />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[15px] font-bold text-foreground">
              {t.clinics.existingClinics}
            </h2>
            <ClinicSearch search={search} />
          </div>
          {!clinics || clinics.length === 0 ? (
            <p className="text-[13.5px] text-secondary">
              {search ? t.clinics.noClinicsMatch : t.clinics.noClinicsYet}
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {clinics.map((clinic) => (
                <ClinicRow
                  key={clinic.id}
                  id={clinic.id}
                  name={clinic.name}
                  createdAt={clinic.created_at}
                  logins={loginsByClinicId.get(clinic.id) ?? []}
                  phone={clinic.phone ?? undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
