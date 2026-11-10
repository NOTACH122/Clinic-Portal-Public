import "server-only";
import { AwsClient } from "aws4fetch";

// R2 is reached through its S3-compatible API rather than a Worker binding,
// so the exact same code path works in `next dev` and in the deployed Worker.
function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured.");
  }

  return { accountId, bucket, accessKeyId, secretAccessKey };
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

function client() {
  const { accessKeyId, secretAccessKey } = config();
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region: "auto",
  });
}

function objectUrl(key: string): URL {
  const { accountId, bucket } = config();
  // Keys are already sanitized to [A-Za-z0-9._/-] by buildStoragePath.
  return new URL(
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`,
  );
}

/** Short-lived URL the browser can PUT the file straight to, bypassing our server. */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresSeconds = 300,
): Promise<string> {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));

  const signed = await client().sign(
    new Request(url, { method: "PUT", headers: { "Content-Type": contentType } }),
    { aws: { signQuery: true } },
  );

  return signed.url;
}

/** Short-lived download URL; `downloadName` restores the original filename. */
export async function presignDownload(
  key: string,
  downloadName?: string,
  expiresSeconds = 60,
): Promise<string> {
  const url = objectUrl(key);
  url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
  if (downloadName) {
    url.searchParams.set(
      "response-content-disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
    );
  }

  const signed = await client().sign(new Request(url), {
    aws: { signQuery: true },
  });

  return signed.url;
}

export async function readObject(key: string): Promise<ArrayBuffer | null> {
  const response = await client().fetch(objectUrl(key).toString());
  if (!response.ok) return null;
  return response.arrayBuffer();
}

export async function deleteObjects(keys: string[]): Promise<void> {
  const r2 = client();
  // Small batches in practice (a clinic's whole file list at most), so
  // individual DELETEs are simpler than the multi-object XML API.
  await Promise.all(
    keys.map((key) =>
      r2.fetch(objectUrl(key).toString(), { method: "DELETE" }).catch(() => null),
    ),
  );
}

/** Total bytes stored, for the free-tier usage meter. */
export async function totalBytesStored(): Promise<number> {
  const { accountId, bucket } = config();
  const r2 = client();
  let total = 0;
  let token: string | undefined;

  do {
    const url = new URL(
      `https://${accountId}.r2.cloudflarestorage.com/${bucket}`,
    );
    url.searchParams.set("list-type", "2");
    url.searchParams.set("max-keys", "1000");
    if (token) url.searchParams.set("continuation-token", token);

    const response = await r2.fetch(url.toString());
    if (!response.ok) break;

    const xml = await response.text();
    for (const match of xml.matchAll(/<Size>(\d+)<\/Size>/g)) {
      total += Number(match[1]);
    }

    const truncated = /<IsTruncated>true<\/IsTruncated>/.test(xml);
    const next = xml.match(
      /<NextContinuationToken>([^<]+)<\/NextContinuationToken>/,
    );
    token = truncated && next ? next[1] : undefined;
  } while (token);

  return total;
}
