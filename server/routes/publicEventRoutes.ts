// Public-facing routes: explore, public event by slug, RSVPs, and public profile.
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { publicEventRsvps } from "@shared/schema";
import { bbqRepo } from "../repositories/bbqRepo";
import { userRepo } from "../repositories/userRepo";
import { requireAuth } from "../middleware/requireAuth";
import { publicRateLimit } from "../middleware/publicRateLimit";
import * as bbqService from "../services/bbqService";
import { db } from "../db";
import { badRequest, conflict, gone, notFound } from "../lib/errors";
import { asyncHandler, getPublicRsvpTiersFromTemplateData } from "./_helpers";

const router = Router();

router.get("/explore/events", publicRateLimit(60, 60_000), asyncHandler(async (_req, res) => {
  const items = await bbqService.listExploreEvents();
  res.json(items);
}));

router.get("/public/events/:slug", publicRateLimit(60, 60_000), asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) badRequest("Invalid slug");
  const result = await bbqService.getPublicEventBySlugForPublicView(slug);
  if (result.status === "expired") gone("Public event listing expired");
  if (result.status === "unavailable") notFound("Public event not found");
  if (result.status === "not_found") notFound("Public event not found");
  res.json(result.event);
}));

router.get("/public/events/:slug/rsvps", publicRateLimit(60, 60_000), asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) badRequest("Invalid slug");
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) notFound("Public event not found");
  if (event.visibility !== "public") notFound("Public event not found");
  if (event.publicListingStatus === "paused") notFound("Public event not found");
  if (!bbqService.isPublicListingActive(event)) {
    if (event.publicListingExpiresAt && event.publicListingExpiresAt.getTime() <= Date.now()) gone("Public event listing expired");
    notFound("Public event not found");
  }
  const tiers = getPublicRsvpTiersFromTemplateData(event.templateData);
  const rows = await db.select().from(publicEventRsvps).where(eq(publicEventRsvps.barbecueId, event.id));
  const countsByTier: Record<string, { requested: number; approved: number; declined: number; going: number }> = {};
  for (const tier of tiers) countsByTier[tier.id] = { requested: 0, approved: 0, declined: 0, going: 0 };
  for (const row of rows) {
    const tierKey = row.tierId ?? "__default__";
    if (!countsByTier[tierKey]) countsByTier[tierKey] = { requested: 0, approved: 0, declined: 0, going: 0 };
    const status = row.status === "approved" || row.status === "declined" || row.status === "going" ? row.status : "requested";
    countsByTier[tierKey][status] += 1;
  }
  const myRsvp = req.session?.userId
    ? rows.find((r) => r.userId === req.session!.userId) ?? null
    : null;
  res.json({
    tiers: tiers.map((tier) => {
      const counts = countsByTier[tier.id] ?? { requested: 0, approved: 0, declined: 0, going: 0 };
      const filled = counts.approved + counts.going;
      return {
        ...tier,
        counts,
        soldOut: tier.capacity != null ? filled >= tier.capacity : false,
      };
    }),
    myRsvp: myRsvp ? { id: myRsvp.id, tierId: myRsvp.tierId ?? null, status: (myRsvp.status as "requested" | "approved" | "declined" | "going") } : null,
  });
}));

router.post("/public/events/:slug/rsvps", requireAuth, asyncHandler(async (req, res) => {
  const slug = String(req.params.slug || "").trim();
  if (!slug) badRequest("Invalid slug");
  const parsed = z.object({
    tierId: z.string().trim().min(1).max(120).nullable().optional(),
    status: z.enum(["requested", "going"]).optional(),
  }).parse(req.body ?? {});
  const event = await bbqRepo.getByPublicSlug(slug);
  if (!event) notFound("Public event not found");
  if (event.visibility !== "public" || event.publicListingStatus === "paused" || !bbqService.isPublicListingActive(event)) notFound("Public event not found");
  const tiers = getPublicRsvpTiersFromTemplateData(event.templateData);
  if (parsed.tierId && !tiers.some((t) => t.id === parsed.tierId)) badRequest("Invalid tier");
  const targetTier = parsed.tierId ? tiers.find((t) => t.id === parsed.tierId) ?? null : null;
  if (targetTier?.capacity != null) {
    const rows = await db.select().from(publicEventRsvps).where(and(eq(publicEventRsvps.barbecueId, event.id), eq(publicEventRsvps.tierId, targetTier.id)));
    const filled = rows.filter((r) => r.status === "approved" || r.status === "going").length;
    if (filled >= targetTier.capacity) conflict("Tier is sold out");
  }
  const status = event.publicMode === "joinable" ? "requested" : (parsed.status ?? "going");
  const existing = await db.select().from(publicEventRsvps).where(and(eq(publicEventRsvps.barbecueId, event.id), eq(publicEventRsvps.userId, req.session!.userId!)));
  let row;
  if (existing[0]) {
    const [updated] = await db.update(publicEventRsvps)
      .set({ tierId: parsed.tierId ?? null, status, name: req.session!.username ?? null, updatedAt: new Date() })
      .where(eq(publicEventRsvps.id, existing[0].id))
      .returning();
    row = updated;
  } else {
    const [created] = await db.insert(publicEventRsvps).values({
      barbecueId: event.id,
      tierId: parsed.tierId ?? null,
      userId: req.session!.userId!,
      email: null,
      name: req.session!.username ?? null,
      status,
    }).returning();
    row = created;
  }
  res.status(201).json({ id: row.id, tierId: row.tierId, status: row.status });
}));

router.get("/public-profile/:username", asyncHandler(async (req, res) => {
  const username = Array.isArray(req.params.username) ? req.params.username[0] : req.params.username;
  if (!username) badRequest("Username required");
  const viewerUsername = req.session?.username;
  const result = await userRepo.getShareablePublicProfile(username, viewerUsername);
  if (!result) notFound("Profile not found");
  res.json(result);
}));

export default router;
