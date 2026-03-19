import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "node:path";
import { log } from "./logger";

const R2_ENABLED =
  !!process.env.R2_ACCOUNT_ID &&
  !!process.env.R2_ACCESS_KEY_ID &&
  !!process.env.R2_SECRET_ACCESS_KEY &&
  !!process.env.R2_BUCKET_NAME;

export const r2 = R2_ENABLED
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? "splanno-uploads";
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
const USE_R2_PUBLIC_STORAGE = !!r2 && !!R2_PUBLIC_URL;

export function resolveStoredFileUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const normalizedKey = key.replace(/^\/+/, "");
  if (USE_R2_PUBLIC_STORAGE) {
    return `${R2_PUBLIC_URL}/${normalizedKey}`;
  }
  return `/uploads/${normalizedKey}`;
}

export async function uploadFile(opts: {
  key: string;
  buffer: Buffer;
  mimeType: string;
  localFallbackPath: string;
  localPublicPath: string;
}): Promise<string> {
  const { promises: fs } = await import("fs");
  const nodePath = await import("path");

  if (USE_R2_PUBLIC_STORAGE) {
    await r2!.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: opts.key,
      Body: opts.buffer,
      ContentType: opts.mimeType,
      CacheControl: "public, max-age=31536000",
    }));
    return `${R2_PUBLIC_URL}/${opts.key}`;
  }

  await fs.mkdir(nodePath.dirname(opts.localFallbackPath), { recursive: true });
  await fs.writeFile(opts.localFallbackPath, opts.buffer);
  return opts.localPublicPath;
}

export async function deleteFile(urlOrPath: string | null | undefined): Promise<void> {
  if (!urlOrPath) return;

  if (USE_R2_PUBLIC_STORAGE && urlOrPath.startsWith(R2_PUBLIC_URL)) {
    const key = urlOrPath.slice(R2_PUBLIC_URL.length + 1);
    await r2!.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return;
  }

  const { promises: fs } = await import("fs");
  const localPath = path.resolve(process.cwd(), "public", urlOrPath.replace(/^\//, ""));
  try {
    await fs.unlink(localPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return;
    throw error;
  }
}

export async function deleteStoredFileByKey(key: string | null | undefined): Promise<void> {
  if (!key) return;
  const normalizedKey = key.replace(/^\/+/, "");
  const { promises: fs } = await import("fs");
  const localPath = path.resolve(process.cwd(), "public/uploads", normalizedKey);

  if (USE_R2_PUBLIC_STORAGE) {
    await r2!.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: normalizedKey }));
    return;
  }

  try {
    await fs.unlink(localPath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") return;
    log("warn", "stored_file_delete_failed", {
      key: normalizedKey,
      code,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
