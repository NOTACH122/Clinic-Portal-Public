"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";
import { normalizeFolderPath } from "@/lib/folderPath";
import { deleteStoredFiles } from "@/lib/storage/files";

export type DeleteFileState = {
  error?: string;
};

export async function deleteFile(
  _prevState: DeleteFileState,
  formData: FormData,
): Promise<DeleteFileState> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  const fileId = String(formData.get("fileId") ?? "");
  if (!fileId) {
    return { error: t.errors.missingFile };
  }

  const supabaseAdmin = createAdminClient();

  const { data: file, error: fetchError } = await supabaseAdmin
    .from("files")
    .select("storage_path, storage_provider")
    .eq("id", fileId)
    .single();

  if (fetchError || !file) {
    return { error: t.errors.fileNotFound };
  }

  await deleteStoredFiles([file]);

  const { error: deleteError } = await supabaseAdmin
    .from("files")
    .delete()
    .eq("id", fileId);

  if (deleteError) {
    return { error: t.errors.couldNotDeleteFile(deleteError.message) };
  }

  revalidatePath("/admin");

  return {};
}

export async function deleteFiles(fileIds: string[]): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  if (!fileIds.length) {
    return { error: t.errors.missingFile };
  }

  const supabaseAdmin = createAdminClient();

  const { data: filesToDelete, error: fetchError } = await supabaseAdmin
    .from("files")
    .select("storage_path, storage_provider")
    .in("id", fileIds);

  if (fetchError) {
    return { error: t.errors.couldNotDeleteFiles(fetchError.message) };
  }

  if (filesToDelete?.length) {
    await deleteStoredFiles(filesToDelete);
  }

  const { error: deleteError } = await supabaseAdmin
    .from("files")
    .delete()
    .in("id", fileIds);

  if (deleteError) {
    return { error: t.errors.couldNotDeleteFiles(deleteError.message) };
  }

  revalidatePath("/admin");

  return {};
}

export async function moveFilesToFolder(
  fileIds: string[],
  folder: string | null,
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const admin = await requireAdmin();
  if (!admin) {
    return { error: t.errors.mustBeAdmin };
  }

  if (!fileIds.length) {
    return { error: t.errors.missingFile };
  }

  const supabaseAdmin = createAdminClient();
  const normalizedFolder = normalizeFolderPath(folder);

  const { error } = await supabaseAdmin
    .from("files")
    .update({ folder: normalizedFolder })
    .in("id", fileIds);

  if (error) {
    return { error: t.errors.couldNotMoveFiles(error.message) };
  }

  revalidatePath("/admin");

  return {};
}
