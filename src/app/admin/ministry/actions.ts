"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

export async function approveMinistrySubmission(
  submissionId: string,
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) return { error: t.errors.mustBeAdmin };

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("ministry_submissions")
    .update({ approved_at: new Date().toISOString(), approved_by: admin.id })
    .eq("id", submissionId);

  if (error) {
    return { error: t.errors.couldNotApproveMinistrySubmission(error.message) };
  }

  revalidatePath("/admin/ministry");
  revalidatePath("/dashboard");

  return {};
}

export async function declineMinistrySubmission(
  submissionId: string,
  reason: string,
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) return { error: t.errors.mustBeAdmin };

  const trimmedReason = reason.trim();
  if (!trimmedReason) return { error: t.errors.declineReasonRequired };

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("ministry_submissions")
    .update({
      declined_at: new Date().toISOString(),
      declined_by: admin.id,
      declined_reason: trimmedReason,
    })
    .eq("id", submissionId);

  if (error) {
    return { error: t.errors.couldNotDeclineMinistrySubmission(error.message) };
  }

  revalidatePath("/admin/ministry");
  revalidatePath("/dashboard");

  return {};
}

export async function deleteMinistrySubmissions(
  submissionIds: string[],
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) return { error: t.errors.mustBeAdmin };

  if (!submissionIds.length) return { error: t.errors.missingFile };

  const supabaseAdmin = createAdminClient();

  await supabaseAdmin
    .from("ministry_download_tokens")
    .delete()
    .in("submission_id", submissionIds);

  await supabaseAdmin
    .from("ministry_submission_files")
    .delete()
    .in("submission_id", submissionIds);

  await supabaseAdmin.storage
    .from("clinic-files")
    .remove(submissionIds.map((id) => `ministry-zips/${id}.zip`));

  const { error } = await supabaseAdmin
    .from("ministry_submissions")
    .delete()
    .in("id", submissionIds);

  if (error) {
    return { error: t.errors.couldNotDeleteMinistrySubmission(error.message) };
  }

  revalidatePath("/admin/ministry");
  revalidatePath("/dashboard");

  return {};
}

export async function attachFinalDocument(
  submissionId: string,
  fileId: string,
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) return { error: t.errors.mustBeAdmin };

  const supabaseAdmin = createAdminClient();

  const { error: linkError } = await supabaseAdmin
    .from("ministry_submission_files")
    .insert({ submission_id: submissionId, file_id: fileId, is_final_document: true });

  if (linkError) {
    return { error: t.errors.couldNotAttachFinalDocument(linkError.message) };
  }

  const { error: updateError } = await supabaseAdmin
    .from("ministry_submissions")
    .update({ final_document_added_at: new Date().toISOString() })
    .eq("id", submissionId);

  if (updateError) {
    return { error: t.errors.couldNotAttachFinalDocument(updateError.message) };
  }

  revalidatePath("/admin/ministry");
  revalidatePath("/dashboard");

  return {};
}
