import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signedDownloadUrl } from "@/lib/storage/files";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: tokenRow } = await supabaseAdmin
    .from("ministry_download_tokens")
    .select("id, file_id, storage_path, max_uses, use_count")
    .eq("token", token)
    .single();

  if (!tokenRow || tokenRow.use_count >= tokenRow.max_uses) {
    return new NextResponse(
      "This download link has expired or reached its usage limit.",
      { status: 410 },
    );
  }

  let storagePath = tokenRow.storage_path as string | null;
  // A path stored on the token itself is a generated zip, which stays on
  // Supabase; clinic files resolved by id may live on either backend.
  let storageProvider: string | null = null;

  if (!storagePath && tokenRow.file_id) {
    const { data: file } = await supabaseAdmin
      .from("files")
      .select("storage_path, storage_provider")
      .eq("id", tokenRow.file_id)
      .single();
    storagePath = file?.storage_path ?? null;
    storageProvider = file?.storage_provider ?? null;
  }

  if (!storagePath) {
    return new NextResponse("File not found.", { status: 404 });
  }

  const signedUrl = await signedDownloadUrl({
    storage_path: storagePath,
    storage_provider: storageProvider,
  });

  if (!signedUrl) {
    return new NextResponse("Could not generate download link.", { status: 500 });
  }

  await supabaseAdmin
    .from("ministry_download_tokens")
    .update({ use_count: tokenRow.use_count + 1 })
    .eq("id", tokenRow.id);

  return NextResponse.redirect(signedUrl);
}
