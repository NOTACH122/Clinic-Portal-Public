"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/normalizePhone";

// Phone numbers are a plain stored identifier on the clinics table, not
// Supabase's native phone-auth field (that requires an SMS provider just
// to switch on). This resolves a typed phone number to the account's real
// email so the actual sign-in can still go through normal email+password.
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  if (identifier.includes("@")) {
    return identifier;
  }

  const phone = normalizePhone(identifier);
  if (!phone) return null;

  const supabaseAdmin = createAdminClient();

  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("id")
    .eq("phone", phone)
    .single();

  if (!clinic) return null;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("clinic_id", clinic.id)
    .eq("role", "clinic")
    .single();

  if (!profile) return null;

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(profile.id);

  return authUser.user?.email ?? null;
}
