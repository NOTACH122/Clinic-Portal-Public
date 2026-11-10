"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

export type AcknowledgeExpiryState = { error?: string };

/**
 * Marks an expired protocol as seen by the clinic, which softens the file's
 * red highlight to amber. Scoped to the caller's own clinic, so one clinic
 * can never acknowledge another's file.
 */
export async function acknowledgeExpiry(
  _prevState: AcknowledgeExpiryState,
  formData: FormData,
): Promise<AcknowledgeExpiryState> {
  const t = getDictionary(await getLocale());

  const fileId = String(formData.get("fileId") ?? "");
  if (!fileId) {
    return { error: t.errors.missingFile };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: t.errors.notAllowed };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "clinic" || !profile.clinic_id) {
    return { error: t.errors.mustBeClinic };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("files")
    .update({ expiry_acknowledged_at: new Date().toISOString() })
    .eq("id", fileId)
    .eq("clinic_id", profile.clinic_id);

  if (error) {
    return { error: t.errors.couldNotAcknowledge(error.message) };
  }

  revalidatePath("/dashboard");

  return {};
}
