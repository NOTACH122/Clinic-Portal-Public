import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import * as r2 from "./r2";

export const SUPABASE_BUCKET = "clinic-files";

export type StoredFile = {
  storage_path: string;
  storage_provider?: string | null;
  filename?: string;
};

/**
 * Rows written before the R2 switch have no provider recorded, so anything
 * that isn't explicitly "r2" is still served from Supabase Storage.
 */
export function isOnR2(file: StoredFile): boolean {
  return file.storage_provider === "r2";
}

export async function signedDownloadUrl(
  file: StoredFile,
): Promise<string | null> {
  if (isOnR2(file)) {
    return r2.presignDownload(file.storage_path, file.filename);
  }

  const { data } = await createAdminClient()
    .storage.from(SUPABASE_BUCKET)
    .createSignedUrl(file.storage_path, 60);

  return data?.signedUrl ?? null;
}

export async function readFileBytes(
  file: StoredFile,
): Promise<ArrayBuffer | null> {
  if (isOnR2(file)) {
    return r2.readObject(file.storage_path);
  }

  const { data } = await createAdminClient()
    .storage.from(SUPABASE_BUCKET)
    .download(file.storage_path);

  return data ? data.arrayBuffer() : null;
}

/** Removes the underlying objects, routing each file to the backend holding it. */
export async function deleteStoredFiles(files: StoredFile[]): Promise<void> {
  const r2Keys = files.filter(isOnR2).map((f) => f.storage_path);
  const supabaseKeys = files.filter((f) => !isOnR2(f)).map((f) => f.storage_path);

  await Promise.all([
    r2Keys.length ? r2.deleteObjects(r2Keys) : Promise.resolve(),
    supabaseKeys.length
      ? createAdminClient()
          .storage.from(SUPABASE_BUCKET)
          .remove(supabaseKeys)
          .then(() => undefined)
      : Promise.resolve(),
  ]);
}
