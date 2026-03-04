// Public event inbox and conversation routes.
import { Router, type Request } from "express";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { publicEventRsvps } from "@shared/schema";
import { requireAuth } from "../middleware/requireAuth";
import { publicInboxRateLimit } from "../middleware/publicInboxRateLimit";
import { publicInboxRepo } from "../repositories/publicInboxRepo";
import { userRepo } from "../repositories/userRepo";
import { bbqRepo } from "../repositories/bbqRepo";
import { db } from "../db";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import {
  asyncHandler,
  getInboxEligibility,
  getPublicEventForInboxOrThrow,
  handleGuestRouteError,
} from "./_helpers";

const router = Router();

router.get("/public-events/:eventId/messaging-eligibility", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");
  const eligibility = await getInboxEligibility(eventId, req.session!.userId!, req.session!.username);
  res.json({
    isOrganizer: eligibility.isOrganizer,
    isApproved: eligibility.isApproved,
    hasJoinRequest: eligibility.hasJoinRequest,
    canMessageOrganizer: eligibility.canMessageOrganizer,
    requestStatus: eligibility.requestStatus,
  });
}));

router.post("/public-events/:eventId/conversations", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  if (!Number.isFinite(eventId)) badRequest("Invalid event id");

  const eligibility = await getInboxEligibility(eventId, req.session!.userId!, req.session!.username);
  if (!eligibility.canMessageOrganizer) forbidden("You can message the organizer only after requesting or joining");

  const parsed = z.object({ message: z.string().trim().min(1).max(2000) }).parse(req.body ?? {});

  let convo = await publicInboxRepo.findConversationForParticipant(eventId, eligibility.organizer.id, req.session!.userId!);
  if (!convo) {
    convo = await publicInboxRepo.createConversation({
      eventId,
      organizerUserId: eligibility.organizer.id,
      participantUserId: req.session!.userId!,
      participantLabel: req.session!.username,
      status: "pending",
    });
  }

  await publicInboxRepo.addMessage({
    conversationId: convo.id,
    senderUserId: req.session!.userId!,
    body: parsed.message,
  });

  const full = await publicInboxRepo.getConversationById(convo.id);
  if (!full) notFound("Conversation not found");

  res.status(201).json(full);
}));

router.get("/conversations", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session!.userId!;
  try {
    const conversations = await publicInboxRepo.listForUser(userId);
    res.json({ conversations });
  } catch (err) {
    return handleGuestRouteError("GET /api/conversations", req, err, res);
  }
}));

router.get("/conversations/:conversationId", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId ?? "").trim();
  if (!conversationId) badRequest("Invalid conversation id");

  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");

  const isParticipant = convo.participantUserId === req.session!.userId;
  const isOrganizer = convo.organizerUserId === req.session!.userId;
  if (!isParticipant && !isOrganizer) forbidden("Conversation not found");

  const messages = await publicInboxRepo.listMessages(conversationId);
  res.json({ ...convo, messages });
}));

router.patch("/conversations/:conversationId", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId ?? "").trim();
  if (!conversationId) badRequest("Invalid conversation id");

  const input = z.object({ status: z.enum(["pending", "active", "archived", "blocked"]) }).parse(req.body ?? {});
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  if (convo.organizerUserId !== req.session!.userId) forbidden("Only organizer can update conversation");

  const updated = await publicInboxRepo.updateConversationStatus(conversationId, input.status);
  if (!updated) notFound("Conversation not found");
  res.json(updated);
}));

router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  asyncHandler(async (req, _res, next) => {
    const conversationId = String(req.params.conversationId ?? "").trim();
    if (!conversationId) badRequest("Invalid conversation id");
    const convo = await publicInboxRepo.getConversationById(conversationId);
    if (!convo) notFound("Conversation not found");
    const userId = req.session!.userId!;
    const isOrganizer = convo.organizerUserId === userId;
    const rsvp = convo && !isOrganizer
      ? (await db.select().from(publicEventRsvps).where(
          and(
            eq(publicEventRsvps.barbecueId, convo.barbecueId),
            eq(publicEventRsvps.userId, userId),
          ),
        ))[0]
      : null;
    const approved = isOrganizer ||
      (!!rsvp && (rsvp.status === "approved" || rsvp.status === "going"));
    (req as Request & { inboxApproved?: boolean }).inboxApproved = approved;
    next();
  }),
  publicInboxRateLimit,
  asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId ?? "").trim();
  if (!conversationId) badRequest("Invalid conversation id");

  const input = z.object({ body: z.string().trim().min(1).max(2000) }).parse(req.body ?? {});
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  if (convo.status === "blocked" || convo.status === "archived") conflict("Conversation is closed");

  const event = await getPublicEventForInboxOrThrow(convo.barbecueId);
  if ((event.visibilityOrigin as string | undefined) === "private") forbidden("Messaging disabled for private events");

  const me = await userRepo.findById(req.session!.userId!);
  const isOrganizer = !!me && event.creatorUserId === me.id;
  if (!isOrganizer && convo.participantUserId !== req.session!.userId) forbidden("Not allowed to post in this conversation");

  const message = await publicInboxRepo.addMessage({
    conversationId,
    senderUserId: req.session!.userId!,
    body: input.body,
  });

  const refreshed = await publicInboxRepo.getConversationById(conversationId);
  if (!refreshed) notFound("Conversation not found");

  res.status(201).json({ message, conversation: refreshed });
}));

router.post("/conversations/:conversationId/read", requireAuth, asyncHandler(async (req, res) => {
  const conversationId = String(req.params.conversationId ?? "").trim();
  if (!conversationId) badRequest("Invalid conversation id");
  const convo = await publicInboxRepo.getConversationById(conversationId);
  if (!convo) notFound("Conversation not found");
  const isParticipant = convo.participantUserId === req.session!.userId;
  const isOrganizer = convo.organizerUserId === req.session!.userId;
  if (!isParticipant && !isOrganizer) forbidden("Conversation not found");
  await publicInboxRepo.markConversationRead(conversationId, req.session!.userId!);
  res.status(204).send();
}));

router.get("/events/:id/rsvp-requests", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await bbqRepo.getById(eventId);
  if (!event) notFound("Event not found");
  if (event.creatorUserId !== req.session!.userId) forbidden("Only creator can view RSVP requests");
  const rows = await bbqRepo.listPublicRsvpRequests(eventId);
  res.json(rows);
}));

router.patch("/events/:id/rsvp-requests/:rsvpId", requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const rsvpId = Number(req.params.rsvpId);
  const event = await bbqRepo.getById(eventId);
  if (!event) notFound("Event not found");
  if (event.creatorUserId !== req.session!.userId) forbidden("Only creator can update RSVP requests");
  const parsed = z.object({ status: z.enum(["approved", "declined", "requested", "going"]) }).parse(req.body ?? {});
  const updated = await bbqRepo.updatePublicRsvpRequest(eventId, rsvpId, parsed.status);
  if (!updated) notFound("RSVP request not found");
  res.json(updated);
}));

export default router;
