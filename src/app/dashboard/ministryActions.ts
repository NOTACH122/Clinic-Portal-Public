"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZipArchive } from "archiver";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLocale } from "@/lib/i18n/getLocale";
import { getDictionary } from "@/lib/i18n/translations";
import { readFileBytes } from "@/lib/storage/files";

const MINISTRY_EMAIL_RECIPIENT = "info@anrs.gov.ge";
const MINISTRY_EMAIL_SUBJECT_KA = "დოკუმენტების წარდგენა";

function ministryEmailIntro(clinicName: string) {
  return `გიგზავნით "${clinicName}"-ს წლიურ ანგარიშგებას, კანონმდებლობის შესაბამისად.`;
}

function createZipBuffer(
  entries: { filename: string; buffer: Buffer }[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", (err: Error) => reject(err));

    for (const entry of entries) {
      archive.append(entry.buffer, { name: entry.filename });
    }

    archive.finalize();
  });
}

async function requireClinic() {
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

  if (profile?.role !== "clinic" || !profile.clinic_id) return null;

  return { userId: user.id, clinicId: profile.clinic_id };
}

export async function createMinistrySubmission(
  fileIds: string[],
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const clinic = await requireClinic();
  if (!clinic) return { error: t.errors.mustBeClinic };

  if (!fileIds.length) return { error: t.errors.missingFile };

  const supabaseAdmin = createAdminClient();

  const { data: ownedFiles } = await supabaseAdmin
    .from("files")
    .select("id")
    .eq("clinic_id", clinic.clinicId)
    .in("id", fileIds);

  const ownedIds = new Set((ownedFiles ?? []).map((f) => f.id));
  const validIds = fileIds.filter((id) => ownedIds.has(id));
  if (!validIds.length) return { error: t.errors.missingFile };

  const { data: submission, error: subError } = await supabaseAdmin
    .from("ministry_submissions")
    .insert({ clinic_id: clinic.clinicId, requested_by: clinic.userId })
    .select()
    .single();

  if (subError || !submission) {
    return {
      error: t.errors.couldNotCreateMinistrySubmission(subError?.message ?? ""),
    };
  }

  const rows = validIds.map((fileId) => ({
    submission_id: submission.id,
    file_id: fileId,
    is_final_document: false,
  }));

  const { error: filesError } = await supabaseAdmin
    .from("ministry_submission_files")
    .insert(rows);

  if (filesError) {
    return { error: t.errors.couldNotCreateMinistrySubmission(filesError.message) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/ministry");

  return {};
}

export async function acknowledgeMinistryDecline(
  submissionId: string,
): Promise<{ error?: string }> {
  const t = getDictionary(await getLocale());

  const clinic = await requireClinic();
  if (!clinic) return { error: t.errors.mustBeClinic };

  const supabaseAdmin = createAdminClient();

  const { data: submission } = await supabaseAdmin
    .from("ministry_submissions")
    .select("id, clinic_id")
    .eq("id", submissionId)
    .single();

  if (!submission || submission.clinic_id !== clinic.clinicId) {
    return { error: t.errors.missingFile };
  }

  await supabaseAdmin
    .from("ministry_submissions")
    .update({ decline_seen_at: new Date().toISOString() })
    .eq("id", submissionId)
    .is("decline_seen_at", null);

  revalidatePath("/dashboard");

  return {};
}

export async function prepareMinistryEmail(
  submissionId: string,
  mode: "zip" | "separate",
): Promise<{ error?: string; mailtoUrl?: string }> {
  const t = getDictionary(await getLocale());

  const clinic = await requireClinic();
  if (!clinic) return { error: t.errors.mustBeClinic };

  const supabaseAdmin = createAdminClient();

  const { data: submission } = await supabaseAdmin
    .from("ministry_submissions")
    .select("id, clinic_id, approved_at, final_document_added_at, clinics(name)")
    .eq("id", submissionId)
    .single();

  if (!submission || submission.clinic_id !== clinic.clinicId) {
    return { error: t.errors.missingFile };
  }

  if (!submission.approved_at || !submission.final_document_added_at) {
    return { error: t.errors.ministryNotReady };
  }

  const clinicName =
    (submission.clinics as unknown as { name: string } | null)?.name ?? "";

  const { data: submissionFiles } = await supabaseAdmin
    .from("ministry_submission_files")
    .select("file_id, files(filename, storage_path, storage_provider)")
    .eq("submission_id", submissionId);

  if (!submissionFiles?.length) {
    return { error: t.errors.missingFile };
  }

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  let bodyLinkLines: string[];

  if (mode === "zip") {
    const entries: { filename: string; buffer: Buffer }[] = [];

    for (const sf of submissionFiles) {
      const fileMeta = sf.files as unknown as
        | { filename: string; storage_path: string; storage_provider: string | null }
        | null;
      if (!fileMeta) continue;

      const bytes = await readFileBytes(fileMeta);

      if (!bytes) {
        return {
          error: t.errors.couldNotPrepareZip(fileMeta.filename),
        };
      }

      entries.push({
        filename: fileMeta.filename,
        buffer: Buffer.from(bytes),
      });
    }

    if (!entries.length) {
      return { error: t.errors.missingFile };
    }

    let zipBuffer: Buffer;
    try {
      zipBuffer = await createZipBuffer(entries);
    } catch (err) {
      return {
        error: t.errors.couldNotPrepareZip(err instanceof Error ? err.message : ""),
      };
    }

    const zipStoragePath = `ministry-zips/${submissionId}.zip`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("clinic-files")
      .upload(zipStoragePath, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });

    if (uploadError) {
      return { error: t.errors.couldNotPrepareZip(uploadError.message) };
    }

    const token = crypto.randomUUID().replace(/-/g, "");

    const { error: tokenError } = await supabaseAdmin
      .from("ministry_download_tokens")
      .insert({
        submission_id: submissionId,
        file_id: null,
        storage_path: zipStoragePath,
        token,
        max_uses: 2,
      });

    if (tokenError) {
      return { error: t.errors.couldNotPrepareZip(tokenError.message) };
    }

    bodyLinkLines = [`${baseUrl}/api/ministry-download/${token}`];
  } else {
    const links: { filename: string; url: string }[] = [];

    for (const sf of submissionFiles) {
      const fileMeta = sf.files as unknown as
        | { filename: string; storage_path: string }
        | null;
      if (!fileMeta) continue;

      const token = crypto.randomUUID().replace(/-/g, "");

      const { error: tokenError } = await supabaseAdmin
        .from("ministry_download_tokens")
        .insert({
          submission_id: submissionId,
          file_id: sf.file_id,
          token,
          max_uses: 2,
        });
      if (tokenError) continue;

      links.push({
        filename: fileMeta.filename,
        url: `${baseUrl}/api/ministry-download/${token}`,
      });
    }

    bodyLinkLines = links.map((l) => `${l.filename}: ${l.url}`);
  }

  await supabaseAdmin
    .from("ministry_submissions")
    .update({ clinic_notified_at: new Date().toISOString() })
    .eq("id", submissionId)
    .is("clinic_notified_at", null);

  const bodyLines = [
    ministryEmailIntro(clinicName),
    "ფაილებით:",
    ...bodyLinkLines,
    "პატივისცემით ადმინისტრაცია.",
  ];

  const mailtoUrl =
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(MINISTRY_EMAIL_RECIPIENT)}` +
    `&su=${encodeURIComponent(MINISTRY_EMAIL_SUBJECT_KA)}` +
    `&body=${encodeURIComponent(bodyLines.join("\n"))}`;

  return { mailtoUrl };
}
