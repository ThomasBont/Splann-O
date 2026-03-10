import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

export async function uploadFile(opts: {
  key: string;
  buffer: Buffer;
  mimeType: string;
  localFallbackPath: string;
  localPublicPath: string;
}): Promise<string> {
  if (r2) {
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: opts.key,
      Body: opts.buffer,
      ContentType: opts.mimeType,
      CacheControl: "public, max-age=31536000",
    }));
    return `${R2_PUBLIC_URL}/${opts.key}`;
  }

  const { promises: fs } = await import("fs");
  const path = await import("path");
  await fs.mkdir(path.dirname(opts.localFallbackPath), { recursive: true });
  await fs.writeFile(opts.localFallbackPath, opts.buffer);
  return opts.localPublicPath;
}

export async function deleteFile(urlOrPath: string | null | undefined): Promise<void> {
  if (!urlOrPath) return;

  if (r2 && R2_PUBLIC_URL && urlOrPath.startsWith(R2_PUBLIC_URL)) {
    const key = urlOrPath.slice(R2_PUBLIC_URL.length + 1);
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => undefined);
    return;
  }

  const { promises: fs } = await import("fs");
  const path = await import("path");
  const localPath = path.resolve(process.cwd(), "public", urlOrPath.replace(/^\//, ""));
  await fs.unlink(localPath).catch(() => undefined);
}
