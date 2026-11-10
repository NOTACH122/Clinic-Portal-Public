"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePassword } from "@/lib/generatePassword";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { normalizePhone } from "@/lib/normalizePhone";
import { deleteStoredFiles } from "@/lib/storage/files";

export type ClinicLogin = { email: string; password: string };

export type CreateClinicState = {
  error?: string;
  success?: {
    clinicName: string;
    phone?: string;
    logins: ClinicLogin[];
  };
};

export async function createClinicLogin(
  _prevState: CreateClinicState,
  formData: FormData,
): Promise<CreateClinicState> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  const clinicName = String(formData.get("clinicName") ?? "").trim();
  // The form submits one "email" field per login row; duplicates are
  // collapsed so the same address cannot be registered twice by accident.
  const emails = [
    ...new Set(
      formData
        .getAll("email")
        .map((value) => String(value).trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  // The phone input defaults to "+995" - if the admin didn't add real
  // digits on top of that, treat it as not provided. This is a plain
  // stored identifier for login lookup, not Supabase's phone-auth field
  // (which requires a paid SMS provider just to enable).
  const normalizedPhone = normalizePhone(phoneRaw);
  const phone = normalizedPhone.length > 3 ? normalizedPhone : undefined;

  if (!clinicName) {
    return { error: t.errors.clinicNameRequired };
  }
  if (!emails.length) {
    return { error: t.errors.atLeastOneEmail };
  }
  if (emails.some((address) => !address.includes("@"))) {
    return { error: t.errors.validEmailRequired };
  }

  const supabaseAdmin = createAdminClient();

  const { data: clinic, error: clinicError } = await supabaseAdmin
    .from("clinics")
    .insert({ name: clinicName, phone: phone ?? null })
    .select("id")
    .single();

  if (clinicError || !clinic) {
    return { error: t.errors.couldNotCreateClinic(clinicError?.message ?? "") };
  }

  const clinicId = clinic.id;
  const logins: ClinicLogin[] = [];
  const createdUserIds: string[] = [];

  // All-or-nothing: if any address fails (already registered, say), undo the
  // clinic and every login made so far rather than leaving a half-set-up
  // clinic behind.
  async function rollback() {
    for (const userId of createdUserIds) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
    }
    await supabaseAdmin.from("clinics").delete().eq("id", clinicId);
  }

  for (const address of emails) {
    const password = generatePassword();

    const { data: authUser, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: address,
        password,
        email_confirm: true,
      });

    if (authError || !authUser.user) {
      await rollback();
      return {
        error: t.errors.couldNotCreateLogin(
          address + ": " + (authError?.message ?? ""),
        ),
      };
    }

    createdUserIds.push(authUser.user.id);

    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: authUser.user.id,
      role: "clinic",
      clinic_id: clinicId,
    });

    if (profileError) {
      await rollback();
      return { error: t.errors.couldNotFinishSetup(profileError.message) };
    }

    logins.push({ email: address, password });
  }

  revalidatePath("/admin/clinics");
  revalidatePath("/admin");

  return { success: { clinicName, phone, logins } };
}

export type AddLoginState = {
  error?: string;
  success?: ClinicLogin;
};

/** Adds another login to a clinic that already exists. */
export async function addClinicLogin(
  _prevState: AddLoginState,
  formData: FormData,
): Promise<AddLoginState> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  const clinicId = String(formData.get("clinicId") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!clinicId) {
    return { error: t.errors.missingClinic };
  }
  if (!email || !email.includes("@")) {
    return { error: t.errors.validEmailRequired };
  }

  const supabaseAdmin = createAdminClient();

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id")
    .eq("id", clinicId)
    .single();

  if (!clinic) {
    return { error: t.errors.missingClinic };
  }

  const password = generatePassword();

  const { data: authUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authUser.user) {
    return { error: t.errors.couldNotCreateLogin(authError?.message ?? "") };
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: authUser.user.id,
    role: "clinic",
    clinic_id: clinicId,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    return { error: t.errors.couldNotFinishSetup(profileError.message) };
  }

  revalidatePath("/admin/clinics");

  return { success: { email, password } };
}

export type RemoveLoginState = { error?: string };

export async function removeClinicLogin(
  _prevState: RemoveLoginState,
  formData: FormData,
): Promise<RemoveLoginState> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) {
    return { error: t.errors.noLoginFound };
  }

  const supabaseAdmin = createAdminClient();

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, clinic_id")
    .eq("id", profileId)
    .single();

  if (!profile?.clinic_id) {
    return { error: t.errors.noLoginFound };
  }

  // Removing the only login would leave the clinic unable to sign in at all.
  const { count } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", profile.clinic_id)
    .eq("role", "clinic");

  if ((count ?? 0) <= 1) {
    return { error: t.errors.cannotRemoveLastLogin };
  }

  // Deleting the auth user cascades to its profiles row.
  await supabaseAdmin.auth.admin.deleteUser(profileId);

  revalidatePath("/admin/clinics");

  return {};
}

export type ResetPasswordState = {
  error?: string;
  success?: {
    email: string;
    password: string;
  };
};

export async function resetClinicPassword(
  _prevState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  // Targets one login by id - a clinic can have several, so resolving by
  // clinic alone would be ambiguous.
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) {
    return { error: t.errors.noLoginFound };
  }

  const supabaseAdmin = createAdminClient();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("role", "clinic")
    .single();

  if (profileError || !profile) {
    return { error: t.errors.noLoginFound };
  }

  const password = generatePassword();

  const { data: updated, error: updateError } =
    await supabaseAdmin.auth.admin.updateUserById(profile.id, { password });

  if (updateError || !updated.user?.email) {
    return { error: t.errors.couldNotResetPassword(updateError?.message ?? "") };
  }

  return { success: { email: updated.user.email, password } };
}

export type DeleteClinicState = {
  error?: string;
};

export async function deleteClinic(
  _prevState: DeleteClinicState,
  formData: FormData,
): Promise<DeleteClinicState> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  const clinicId = String(formData.get("clinicId") ?? "");
  if (!clinicId) {
    return { error: t.errors.missingClinic };
  }

  const supabaseAdmin = createAdminClient();

  const { data: files } = await supabaseAdmin
    .from("files")
    .select("storage_path, storage_provider")
    .eq("clinic_id", clinicId);

  if (files?.length) {
    await deleteStoredFiles(files);
  }

  await supabaseAdmin.from("files").delete().eq("clinic_id", clinicId);

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clinic_id", clinicId);

  for (const profile of profiles ?? []) {
    // Deleting the auth user cascades to delete its profiles row too.
    await supabaseAdmin.auth.admin.deleteUser(profile.id);
  }

  const { error: clinicError } = await supabaseAdmin
    .from("clinics")
    .delete()
    .eq("id", clinicId);

  if (clinicError) {
    return { error: t.errors.couldNotDeleteClinic(clinicError.message) };
  }

  revalidatePath("/admin/clinics");
  revalidatePath("/admin");

  return {};
}
