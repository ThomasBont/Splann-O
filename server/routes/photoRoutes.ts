import path from "node:path";
import express, { Router, type Request } from "express";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { api } from "@shared/routes";
import { barbecues, eventPhotos, users, type EventPhotoWithUploader } from "@shared/schema";
import { db } from "../db";
import { AppError, badRequest, notFound } from "../lib/errors";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { log } from "../lib/logger";
import { deleteStoredFileByKey, resolveStoredFileUrl, uploadFile } from "../lib/r2";
import { requireAuth } from "../middleware/requireAuth";
import { photoUploadLimiter } from "../middleware/rate-limit";
import { assertEventAccessOrThrow, assertSocialMutationWritable, asyncHandler, isAdmin, p } from "./_helpers";

const router = Router();

const MAX_PHOTO_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_LIST_LIMIT = 24;
const MAX_LIST_LIMIT = 60;
const THUMBNAIL_MAX_DIMENSION = 400;
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const rawPhotoUpload = express.raw({
  type: Array.from(ALLOWED_MIME_TYPES),
  limit: `${MAX_PHOTO_UPLOAD_BYTES}b`,
});
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

type PhotoListRow = {
  id: string;
  eventId: number;
  uploadedByUserId: number;
  storageKeyOriginal: string;
  storageKeyThumb: string | null;
  caption: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date | null;
  deletedAt: Date | null;
  uploaderId: number | null;
  uploaderUsername: string | null;
  uploaderDisplayName: string | null;
  uploaderAvatarUrl: string | null;
};

function parsePlanId(req: Request) {
  const planId = Number(req.params.planId);
  if (!Number.isFinite(planId) || planId <= 0) badRequest("Invalid plan id");
  return planId;
}

function parseListLimit(req: Request) {
  const raw = Number(req.query.limit ?? DEFAULT_LIST_LIMIT);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(raw)));
}

function parseCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: string;
      id?: string;
    };
    const createdAt = decoded.createdAt ? new Date(decoded.createdAt) : null;
    const id = typeof decoded.id === "string" ? decoded.id.trim() : "";
    if (!createdAt || Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    badRequest("Invalid cursor");
  }
}

function buildCursor(row: { createdAt: Date | null; id: string }) {
  if (!row.createdAt) return null;
  return Buffer.from(JSON.stringify({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  }), "utf8").toString("base64url");
}

function parseUploadMetadata(req: Request) {
  const fileName = String(req.query.filename ?? req.get("x-file-name") ?? "").trim();
  const captionRaw = String(req.query.caption ?? "").trim();
  const caption = captionRaw ? captionRaw.slice(0, 280) : null;
  if (!fileName) badRequest("filename is required");
  return { fileName, caption };
}

function getExtension(fileName: string, mimeType: string) {
  const fromName = path.extname(fileName).toLowerCase();
  if (fromName && [".jpg", ".jpeg", ".png", ".webp"].includes(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName;
  }
  return EXT_BY_MIME[mimeType] ?? ".bin";
}

async function getImageProcessor() {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{
    default: (input?: Buffer) => {
      metadata: () => Promise<{ width?: number; height?: number }>;
      resize: (...args: unknown[]) => {
        webp: (...args: unknown[]) => { toBuffer: () => Promise<Buffer> };
      };
    };
  }>;
  try {
    const mod = await dynamicImport("sharp");
    return mod.default;
  } catch (error) {
    log("error", "photo_thumbnail_processor_missing", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new AppError("PHOTO_PROCESSING_UNAVAILABLE", "Photo processing is not available on this server.", 500);
  }
}

async function buildThumbnail(buffer: Buffer) {
  const sharp = await getImageProcessor();
  const pipeline = sharp(buffer);
  const metadata = await pipeline.metadata();
  const thumbBuffer = await sharp(buffer)
    .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  return {
    thumbBuffer,
    width: typeof metadata.width === "number" ? metadata.width : null,
    height: typeof metadata.height === "number" ? metadata.height : null,
  };
}

function serializePhoto(row: PhotoListRow): EventPhotoWithUploader {
  return {
    id: row.id,
    eventId: row.eventId,
    uploadedByUserId: row.uploadedByUserId,
    storageKeyOriginal: row.storageKeyOriginal,
    storageKeyThumb: row.storageKeyThumb,
    caption: row.caption,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt,
    deletedAt: row.deletedAt,
    imageUrl: resolveStoredFileUrl(row.storageKeyOriginal) ?? "",
    thumbUrl: resolveStoredFileUrl(row.storageKeyThumb) ?? resolveStoredFileUrl(row.storageKeyOriginal),
    uploader: row.uploaderId != null ? {
      id: row.uploaderId,
      username: row.uploaderUsername,
      displayName: row.uploaderDisplayName,
      avatarUrl: row.uploaderAvatarUrl,
    } : null,
  };
}

async function fetchPhotoRow(photoId: string) {
  const rows = await db
    .select({
      id: eventPhotos.id,
      eventId: eventPhotos.eventId,
      uploadedByUserId: eventPhotos.uploadedByUserId,
      storageKeyOriginal: eventPhotos.storageKeyOriginal,
      storageKeyThumb: eventPhotos.storageKeyThumb,
      caption: eventPhotos.caption,
      mimeType: eventPhotos.mimeType,
      fileSize: eventPhotos.fileSize,
      width: eventPhotos.width,
      height: eventPhotos.height,
      createdAt: eventPhotos.createdAt,
      deletedAt: eventPhotos.deletedAt,
      uploaderId: users.id,
      uploaderUsername: users.username,
      uploaderDisplayName: users.displayName,
      uploaderAvatarUrl: users.avatarUrl,
    })
    .from(eventPhotos)
    .leftJoin(users, eq(eventPhotos.uploadedByUserId, users.id))
    .where(eq(eventPhotos.id, photoId))
    .limit(1);

  return rows[0] ?? null;
}

router.get(p(api.photos.list.path), requireAuth, asyncHandler(async (req, res) => {
  const planId = parsePlanId(req);
  const limit = parseListLimit(req);
  const cursor = parseCursor(typeof req.query.cursor === "string" ? req.query.cursor : null);
  await assertEventAccessOrThrow(req, planId);
  const cursorCondition = cursor
    ? or(
        lt(eventPhotos.createdAt, cursor.createdAt),
        and(eq(eventPhotos.createdAt, cursor.createdAt), lt(eventPhotos.id, cursor.id)),
      )
    : undefined;

  const rows = await db
    .select({
      id: eventPhotos.id,
      eventId: eventPhotos.eventId,
      uploadedByUserId: eventPhotos.uploadedByUserId,
      storageKeyOriginal: eventPhotos.storageKeyOriginal,
      storageKeyThumb: eventPhotos.storageKeyThumb,
      caption: eventPhotos.caption,
      mimeType: eventPhotos.mimeType,
      fileSize: eventPhotos.fileSize,
      width: eventPhotos.width,
      height: eventPhotos.height,
      createdAt: eventPhotos.createdAt,
      deletedAt: eventPhotos.deletedAt,
      uploaderId: users.id,
      uploaderUsername: users.username,
      uploaderDisplayName: users.displayName,
      uploaderAvatarUrl: users.avatarUrl,
    })
    .from(eventPhotos)
    .leftJoin(users, eq(eventPhotos.uploadedByUserId, users.id))
    .where(and(
      eq(eventPhotos.eventId, planId),
      isNull(eventPhotos.deletedAt),
      cursorCondition,
    ))
    .orderBy(desc(eventPhotos.createdAt), desc(eventPhotos.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map(serializePhoto);
  const nextCursor = hasMore ? buildCursor(rows[limit - 1]!) : null;

  res.json({ items, nextCursor });
}));

router.post(
  p(api.photos.upload.path),
  requireAuth,
  photoUploadLimiter,
  rawPhotoUpload,
  asyncHandler(async (req, res) => {
    const planId = parsePlanId(req);
    await assertEventAccessOrThrow(req, planId);
    await assertSocialMutationWritable(planId, "PHOTOS_UPLOADS_CLOSED", "Uploads are no longer available for this plan.");

    const mimeType = String(req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      badRequest("Only JPEG, PNG, and WebP images are supported.");
    }

    const body = Buffer.isBuffer(req.body)
      ? req.body
      : ArrayBuffer.isView(req.body)
        ? Buffer.from(req.body.buffer, req.body.byteOffset, req.body.byteLength)
        : Buffer.alloc(0);

    if (!body.length) badRequest("Image file is required.");
    if (body.length > MAX_PHOTO_UPLOAD_BYTES) {
      badRequest(`Image must be ${Math.round(MAX_PHOTO_UPLOAD_BYTES / (1024 * 1024))}MB or smaller.`);
    }

    const { fileName, caption } = parseUploadMetadata(req);
    const extension = getExtension(fileName, mimeType);
    const uploadedByUserId = req.session!.userId!;
    const reqId = (req as Request & { requestId?: string }).requestId;

    log("info", "photo_upload_requested", {
      reqId,
      planId,
      userId: uploadedByUserId,
      mimeType,
      sizeBytes: body.length,
      fileName,
    });

    const inserted = (await db.insert(eventPhotos).values({
      eventId: planId,
      uploadedByUserId,
      storageKeyOriginal: "",
      storageKeyThumb: null,
      caption,
      mimeType,
      fileSize: body.length,
      width: null,
      height: null,
    }).returning())[0];

    if (!inserted) throw new Error("Failed to create photo record");

    const storageKeyOriginal = `plans/${planId}/photos/${inserted.id}/original${extension}`;
    const storageKeyThumb = `plans/${planId}/photos/${inserted.id}/thumb.webp`;

    try {
      const { thumbBuffer, width, height } = await buildThumbnail(body);

      await uploadFile({
        key: storageKeyOriginal,
        buffer: body,
        mimeType,
        localFallbackPath: path.resolve(process.cwd(), "public/uploads", storageKeyOriginal),
        localPublicPath: `/uploads/${storageKeyOriginal}`,
      });

      await uploadFile({
        key: storageKeyThumb,
        buffer: thumbBuffer,
        mimeType: "image/webp",
        localFallbackPath: path.resolve(process.cwd(), "public/uploads", storageKeyThumb),
        localPublicPath: `/uploads/${storageKeyThumb}`,
      });

      await db.update(eventPhotos)
        .set({
          storageKeyOriginal,
          storageKeyThumb,
          width,
          height,
        })
        .where(eq(eventPhotos.id, inserted.id));

      const row = await fetchPhotoRow(inserted.id);
      if (!row) throw new Error("Failed to load created photo");

      log("info", "photo_upload_succeeded", {
        reqId,
        planId,
        userId: uploadedByUserId,
        photoId: inserted.id,
        mimeType,
        sizeBytes: body.length,
      });
      broadcastEventRealtime(planId, { type: "photos:updated", eventId: planId });
      res.status(201).json(serializePhoto(row));
    } catch (error) {
      log("error", "photo_upload_failed", {
        reqId,
        planId,
        userId: uploadedByUserId,
        photoId: inserted.id,
        mimeType,
        sizeBytes: body.length,
        message: error instanceof Error ? error.message : String(error),
      });
      await Promise.allSettled([
        deleteStoredFileByKey(storageKeyOriginal),
        deleteStoredFileByKey(storageKeyThumb),
      ]);
      await db.delete(eventPhotos).where(eq(eventPhotos.id, inserted.id));
      throw error;
    }
  }),
);

router.delete(p(api.photos.delete.path), requireAuth, asyncHandler(async (req, res) => {
  const planId = parsePlanId(req);
  const photoId = String(req.params.photoId ?? "").trim();
  if (!photoId) badRequest("Invalid photo id");
  await assertEventAccessOrThrow(req, planId);
  await assertSocialMutationWritable(planId, "PHOTOS_UPLOADS_CLOSED", "Uploads are no longer available for this plan.");

  const [photo] = await db
    .select()
    .from(eventPhotos)
    .where(and(eq(eventPhotos.id, photoId), eq(eventPhotos.eventId, planId), isNull(eventPhotos.deletedAt)))
    .limit(1);

  if (!photo) notFound("Photo not found");

  const [plan] = await db
    .select({ creatorUserId: barbecues.creatorUserId })
    .from(barbecues)
    .where(eq(barbecues.id, planId))
    .limit(1);

  if (!plan) notFound("Plan not found");

  const userId = req.session!.userId!;
  const canDelete = photo.uploadedByUserId === userId || plan.creatorUserId === userId || isAdmin(req);
  if (!canDelete) {
    throw new AppError("ONLY_UPLOADER_CAN_DELETE_PHOTO", "Only the uploader or plan owner can delete this photo.", 403);
  }
  const reqId = (req as Request & { requestId?: string }).requestId;

  try {
    if (photo.storageKeyOriginal) {
      await deleteStoredFileByKey(photo.storageKeyOriginal);
    }
    if (photo.storageKeyThumb) {
      await deleteStoredFileByKey(photo.storageKeyThumb);
    }
  } catch (error) {
    log("error", "photo_delete_storage_failed", {
      planId,
      photoId: photo.id,
      message: error instanceof Error ? error.message : String(error),
    });
    throw new AppError("PHOTO_DELETE_STORAGE_FAILED", "Couldn’t remove the stored photo files.", 500);
  }

  await db.update(eventPhotos)
    .set({ deletedAt: new Date() })
    .where(eq(eventPhotos.id, photo.id));

  log("info", "photo_delete_succeeded", {
    reqId,
    planId,
    photoId: photo.id,
    userId,
  });
  broadcastEventRealtime(planId, { type: "photos:updated", eventId: planId });
  res.status(204).send();
}));

export default router;
