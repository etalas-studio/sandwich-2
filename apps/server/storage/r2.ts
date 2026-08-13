import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

/**
 * Cloudflare R2 (S3-compatible) object storage for uploaded attachments.
 * Bytes never live in Postgres — only the metadata row does.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID        — Cloudflare account id
 *   R2_ACCESS_KEY_ID     — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET_NAME       — bucket name
 *   R2_PUBLIC_URL        — optional public base URL (e.g. https://pub-xxx.r2.dev)
 *                          when set, GET urls are built from it instead of
 *                          presigned (presigned used otherwise).
 */

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB — attachments only, not media libraries

function clientConfig(): S3ClientConfig {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)",
    );
  }
  return {
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  };
}

let client: S3Client | null = null;
function getClient(): S3Client {
  if (!client) client = new S3Client(clientConfig());
  return client;
}

export function storageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

export function makeStorageKey(
  userId: string,
  originalFilename: string,
): string {
  const safe = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  return `attachments/${userId}/${randomUUID()}-${safe}`;
}

export async function uploadToStorage(
  key: string,
  body: Buffer,
  mimeType: string,
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: mimeType,
    }),
  );
}

export async function downloadFromStorage(key: string): Promise<Buffer> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  );
  if (!res.Body) throw new Error(`R2 object is empty: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function getAttachmentUrl(key: string): Promise<string> {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  }
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
    { expiresIn: 60 * 60 * 24 * 7 }, // 7 days
  );
}

export { MAX_UPLOAD_BYTES };
