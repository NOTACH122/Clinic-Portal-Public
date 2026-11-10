// Supabase Storage object keys reject many Unicode characters (accents,
// non-Latin scripts, etc.) and are picky about symbols/spaces. The original
// filename is still kept as-is in the `files.filename` column for display -
// this only sanitizes the key used to store the object.
function sanitizeFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  const base = lastDot > 0 ? filename.slice(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.slice(lastDot) : "";

  const safeBase = base
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "") // strip accents from Latin letters
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "");

  return (safeBase || "file") + safeExt;
}

export function buildStoragePath(clinicId: string, filename: string): string {
  return `${clinicId}/${Date.now()}-${sanitizeFilename(filename)}`;
}
