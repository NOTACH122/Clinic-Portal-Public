"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildStoragePath } from "@/lib/storagePath";
import { presignUpload, isR2Configured } from "@/lib/storage/r2";
import { signedDownloadUrl } from "@/lib/storage/files";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";

type Viewer = { id: string; role: string; clinicId: string | null } | null;

async function currentViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, clinic_id")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return { id: user.id, role: profile.role, clinicId: profile.clinic_id };
}

/**
 * R2 has no row-level security, so every signed URL is gated here instead:
 * admins reach any clinic, a clinic reaches only its own files.
 */
function canReach(viewer: Viewer, clinicId: string | null): boolean {
  if (!viewer) return false;
  if (viewer.role === "admin") return true;
  return Boolean(clinicId) && viewer.clinicId === clinicId;
}

export async function createUploadTicket(
  clinicId: string,
  filename: string,
  contentType: string,
): Promise<{ uploadUrl?: string; storagePath?: string; error?: string }> {
  const t = getDictionary(await getLocale());

  const viewer = await currentViewer();
  if (!canReach(viewer, clinicId)) {
    return { error: t.errors.notAllowed };
  }
  if (!isR2Configured()) {
    return { error: t.errors.storageUnavailable };
  }

  const storagePath = buildStoragePath(clinicId, filename);

  try {
    const uploadUrl = await presignUpload(
      storagePath,
      contentType || "application/octet-stream",
    );
    return { uploadUrl, storagePath };
  } catch {
    return { error: t.errors.storageUnavailable };
  }
}

export async function createDownloadUrl(
  fileId: string,
): Promise<{ url?: string; error?: string }> {
  const t = getDictionary(await getLocale());

  const viewer = await currentViewer();
  if (!viewer) return { error: t.errors.notAllowed };

  const { data: file } = await createAdminClient()
    .from("files")
    .select("clinic_id, filename, storage_path, storage_provider")
    .eq("id", fileId)
    .single();

  if (!file) return { error: t.errors.fileNotFound };
  if (!canReach(viewer, file.clinic_id)) return { error: t.errors.notAllowed };

  const url = await signedDownloadUrl(file);
  return url ? { url } : { error: t.errors.fileNotFound };
}
