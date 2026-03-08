// Media routes: SVG share card, banner upload/delete, media import, and Stripe webhook.
import { Router, type Request } from "express";
import { eq } from "drizzle-orm";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { z } from "zod";
import { barbecues, stripeEvents } from "@shared/schema";
import { bbqRepo } from "../repositories/bbqRepo";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { log } from "../lib/logger";
import { createStripeCheckoutSession, verifyStripeWebhookSignature } from "../lib/stripe";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";
import {
  assertEventAccessOrThrow,
  assertPublicRemoteUrlOrThrow,
  asyncHandler,
  getBarbecueOr404,
  getEventBannerFileNameFromUrl,
  imageExtensionByMime,
  isAdmin,
  publicModeSchema,
  readImageResponseBodyWithLimit,
  toPublicUploadsUrl,
} from "./_helpers";
import * as bbqService from "../services/bbqService";
import { resolveBaseUrl } from "../config/env";

const router = Router();
const EVENT_BANNER_UPLOAD_DIR = path.resolve(process.cwd(), "public/uploads/event-banners");
const MAX_EVENT_BANNER_SIZE_BYTES = 5 * 1024 * 1024;
const MEDIA_IMPORT_TIMEOUT_MS = 15_000;
const MEDIA_IMPORT_MAX_BYTES = 5 * 1024 * 1024;

router.get("/share/event/:id.svg", asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");

  const title = String(bbq.name || "Splanno plan").slice(0, 80);
  const subtitle = `${bbq.city || bbq.locationName || ""}`.trim();
  const date = bbq.date ? new Date(bbq.date).toLocaleDateString() : "";
  const bg = "#0f172a";
  const fg = "#f8fafc";
  const muted = "#94a3b8";
  const accent = "#fbbf24";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${title.replace(/&/g, "&amp;")}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="100%" stop-color="#0b1020"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <circle cx="1040" cy="120" r="180" fill="${accent}" fill-opacity="0.08"/>
  <circle cx="140" cy="560" r="220" fill="#38bdf8" fill-opacity="0.06"/>

  <text x="84" y="118" fill="${muted}" font-family="Inter,system-ui,Segoe UI,Arial" font-size="28" letter-spacing="2">SPLANNO</text>
  <text x="84" y="240" fill="${fg}" font-family="Georgia,Times New Roman,serif" font-size="68" font-weight="700">${title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
  <text x="84" y="308" fill="${muted}" font-family="Inter,system-ui,Segoe UI,Arial" font-size="34">${[subtitle, date].filter(Boolean).join(" · ").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>

  <rect x="84" y="404" width="480" height="92" rx="20" fill="#111827" fill-opacity="0.58" stroke="#334155"/>
  <text x="118" y="462" fill="${fg}" font-family="Inter,system-ui,Segoe UI,Arial" font-size="34" font-weight="600">Split costs, stay friends</text>

  <rect x="914" y="524" width="202" height="58" rx="29" fill="${accent}"/>
  <text x="1015" y="562" text-anchor="middle" fill="${bg}" font-family="Inter,system-ui,Segoe UI,Arial" font-size="24" font-weight="700">splanno.app</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(svg);
}));

router.post("/events/:id/checkout-public-listing", requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const bbq = await bbqRepo.getById(id);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorUserId !== req.session!.userId) forbidden("Only the creator can activate listing");
  const body = z.object({ publicMode: publicModeSchema.optional() }).parse(req.body ?? {});

  const appUrl = resolveBaseUrl();
  const priceId = process.env.STRIPE_PRICE_PUBLIC_LISTING?.trim();
  if (!priceId) badRequest("STRIPE_PRICE_PUBLIC_LISTING is not configured");
  const checkoutPublicMode = body.publicMode ?? (bbq.publicMode as "marketing" | "joinable" | undefined) ?? "marketing";

  const session = await createStripeCheckoutSession({
    priceId,
    successUrl: `${appUrl}/app?listing=success&eventId=${id}&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/app?listing=cancel&eventId=${id}`,
    idempotencyKey: `public-listing:${id}:${req.session!.userId ?? req.session!.username}:${checkoutPublicMode}`,
    metadata: {
      eventId: String(id),
      userId: String(req.session!.userId),
      action: "activate_public_listing",
      intendedAction: "activate_public_listing",
      publishAfterActivation: "true",
      publicMode: checkoutPublicMode,
    },
  });

  if (!session.url) badRequest("Stripe checkout session did not return a URL");
  res.json({ url: session.url });
}));

router.post("/stripe/webhook", asyncHandler(async (req, res) => {
  const rawBody = (req as Request & { rawBody?: unknown }).rawBody;
  if (!Buffer.isBuffer(rawBody)) badRequest("Missing raw webhook body");
  const event = verifyStripeWebhookSignature(rawBody, req.headers["stripe-signature"] as string | undefined) as {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  const eventId = String(event.id ?? "").trim();
  const eventType = String(event.type ?? "").trim();
  if (!eventId || !eventType) badRequest("Invalid Stripe event payload");

  const existingProcessed = await db.select().from(stripeEvents).where(eq(stripeEvents.id, eventId));
  if (existingProcessed.length > 0) {
    res.json({ received: true, duplicate: true });
    return;
  }

  if (eventType === "checkout.session.completed") {
    const object = (event.data?.object ?? {}) as {
      metadata?: Record<string, string | undefined>;
      payment_status?: string;
    };
    const metadata = object.metadata ?? {};
    const action = metadata.action ?? metadata.intendedAction;
    if (action === "activate_public_listing" && metadata.eventId) {
      const eventIdNum = Number(metadata.eventId);
      if (Number.isFinite(eventIdNum)) {
        const publishAfterActivation = metadata.publishAfterActivation === "true";
        const publicMode = metadata.publicMode === "joinable" ? "joinable" : metadata.publicMode === "marketing" ? "marketing" : undefined;
        await bbqService.activateListingBySystem(eventIdNum, {
          publishAfterActivation,
          publicMode,
        });
      }
    }
  }

  await db.insert(stripeEvents).values({ id: eventId }).onConflictDoNothing({ target: stripeEvents.id });
  res.json({ received: true });
}));

router.post("/barbecues/:bbqId/banner", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  if (!Number.isFinite(bbqId)) badRequest("Invalid event id");
  const bbq = await getBarbecueOr404(req, bbqId);
  if (bbq.visibilityOrigin !== "private") forbidden("Banner editing via this action is available for private events only");
  const username = req.session?.username;
  if (!username) unauthorized("Not authenticated");
  if (!isAdmin(req)) {
    await assertEventAccessOrThrow(req, bbqId);
  }

  const payload = z.object({ dataUrl: z.string().min(1) }).parse(req.body ?? {});
  const match = payload.dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) badRequest("Invalid banner image");

  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const allowedMime = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
  if (!allowedMime.has(mime)) badRequest("Unsupported image type");

  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) badRequest("Invalid image payload");
  if (buffer.length > MAX_EVENT_BANNER_SIZE_BYTES) badRequest("Banner image must be 5MB or smaller");

  const extensionByMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  const ext = extensionByMime[mime] ?? "jpg";
  const fileName = `event-${bbqId}-${randomUUID()}.${ext}`;
  await fs.mkdir(EVENT_BANNER_UPLOAD_DIR, { recursive: true });
  const filePath = path.join(EVENT_BANNER_UPLOAD_DIR, fileName);
  await fs.writeFile(filePath, buffer);

  const prevBannerUrl = bbq.bannerImageUrl ?? null;
  const relativeBannerPath = `/uploads/event-banners/${fileName}`;
  const publicBannerUrl = toPublicUploadsUrl(req, relativeBannerPath);
  const bannerImageUrl = relativeBannerPath;
  if (process.env.NODE_ENV !== "production") {
    log("info", "Banner uploaded", {
      route: "POST /api/barbecues/:bbqId/banner",
      uploadDir: EVENT_BANNER_UPLOAD_DIR,
      fileName,
      storedBannerImageUrl: bannerImageUrl,
      storedBannerAssetId: fileName,
      publicBannerUrl,
    });
  }
  const updated = await bbqRepo.update(bbqId, {
    bannerImageUrl,
    bannerAssetId: fileName,
  });
  if (!updated) notFound("Event not found");

  const prevFileName = getEventBannerFileNameFromUrl(prevBannerUrl);
  if (prevFileName) {
    const oldPath = path.join(EVENT_BANNER_UPLOAD_DIR, prevFileName);
    await fs.unlink(oldPath).catch(() => undefined);
  }

  res.json({
    bbqId,
    assetId: fileName,
    url: relativeBannerPath,
    path: relativeBannerPath,
    mime,
    size: buffer.length,
    bannerImageUrl: updated.bannerImageUrl ?? null,
    bannerAssetId: updated.bannerAssetId ?? null,
  });
}));

router.post("/media/import", requireAuth, asyncHandler(async (req, res) => {
  const payload = z.object({ url: z.string().trim().min(1) }).parse(req.body ?? {});
  const remoteUrl = await assertPublicRemoteUrlOrThrow(payload.url);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), MEDIA_IMPORT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(remoteUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: abortController.signal,
      headers: {
        Accept: "image/*,*/*;q=0.8",
        "User-Agent": "SplannoMediaImporter/1.0",
      },
    });
  } catch {
    clearTimeout(timeout);
    badRequest("Could not fetch media from URL");
  }
  clearTimeout(timeout);

  if (!response.ok) {
    badRequest(`Remote server returned ${response.status}`);
  }
  await assertPublicRemoteUrlOrThrow(response.url);

  const contentTypeHeader = String(response.headers.get("content-type") ?? "").toLowerCase();
  const mime = contentTypeHeader.split(";")[0].trim();
  if (!mime.startsWith("image/")) {
    badRequest("Provided URL does not return an image");
  }

  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const length = Number(contentLengthHeader);
    if (Number.isFinite(length) && length > MEDIA_IMPORT_MAX_BYTES) {
      badRequest("Image must be 5MB or smaller");
    }
  }

  const ext = imageExtensionByMime[mime] ?? "jpg";
  const buffer = await readImageResponseBodyWithLimit(response, MEDIA_IMPORT_MAX_BYTES);
  const fileName = `event-import-${Date.now()}-${randomUUID()}.${ext}`;
  await fs.mkdir(EVENT_BANNER_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(path.join(EVENT_BANNER_UPLOAD_DIR, fileName), buffer);

  const storedPath = `/uploads/event-banners/${fileName}`;
  res.status(201).json({
    storedUrl: storedPath,
    url: storedPath,
    path: storedPath,
    mime,
    size: buffer.length,
  });
}));

router.delete("/barbecues/:bbqId/banner", requireAuth, asyncHandler(async (req, res) => {
  const bbqId = Number(req.params.bbqId);
  if (!Number.isFinite(bbqId)) badRequest("Invalid event id");
  const bbq = await getBarbecueOr404(req, bbqId);
  if (bbq.visibilityOrigin !== "private") forbidden("Banner editing via this action is available for private events only");
  const username = req.session?.username;
  if (!username) unauthorized("Not authenticated");
  if (!isAdmin(req)) {
    await assertEventAccessOrThrow(req, bbqId);
  }

  const oldFileName = bbq.bannerAssetId ?? getEventBannerFileNameFromUrl(bbq.bannerImageUrl ?? null);
  if (oldFileName) {
    const oldPath = path.join(EVENT_BANNER_UPLOAD_DIR, oldFileName);
    await fs.unlink(oldPath).catch(() => undefined);
  }

  const updated = await bbqRepo.update(bbqId, { bannerImageUrl: null, bannerAssetId: null });
  if (!updated) notFound("Event not found");
  res.json({ bbqId, bannerImageUrl: null, bannerAssetId: null });
}));

export default router;
