// Notes routes for event notes CRUD.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { api } from "@shared/routes";
import { notes } from "@shared/schema";
import { expenseRepo } from "../repositories/expenseRepo";
import { participantRepo } from "../repositories/participantRepo";
import { db } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { logPlanActivity } from "../lib/planActivity";
import { requireAuth } from "../middleware/requireAuth";
import { assertEventAccessOrThrow, asyncHandler, p } from "./_helpers";

const router = Router();

router.get(p(api.notes.list.path), requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  await assertEventAccessOrThrow(req, eventId);
  const items = await expenseRepo.getNotes(eventId);
  res.json(items);
}));

router.post(p(api.notes.create.path), requireAuth, asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  await assertEventAccessOrThrow(req, eventId);
  const input = api.notes.create.input.parse(req.body);
  const participant = await participantRepo.getById(input.participantId);
  if (!participant || participant.barbecueId !== eventId) {
    forbidden("Invalid participant for this event");
  }
  if (!req.session?.userId || participant.userId !== req.session.userId) {
    forbidden("Can only create notes as yourself");
  }
  const created = await expenseRepo.createNote({
    barbecueId: eventId,
    participantId: input.participantId,
    title: input.title ?? null,
    body: input.body,
    pinned: input.pinned ?? false,
  });
  const noteTitle = typeof created.title === "string" && created.title.trim()
    ? created.title.trim()
    : "a note";
  const actorName = created.authorName || req.session?.username || "Someone";
  await logPlanActivity({
    eventId,
    type: "NOTE_ADDED",
    actorUserId: req.session?.userId ?? null,
    actorName,
    message: `${actorName} added a note · ${noteTitle}`,
    meta: {
      noteId: created.id,
      title: created.title ?? null,
      pinned: created.pinned === true,
    },
  });
  res.status(201).json(created);
}));

router.patch(p(api.notes.update.path), requireAuth, asyncHandler(async (req, res) => {
  const noteId = Number(req.params.noteId);
  const input = api.notes.update.input.parse(req.body);
  const existing = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!existing[0]) notFound("Note not found");
  const participant = await participantRepo.getById(existing[0].participantId);
  if (!participant) notFound("Participant not found");
  await assertEventAccessOrThrow(req, participant.barbecueId);
  const userId = req.session!.userId!;
  if (participant.userId !== userId) {
    forbidden("Can only edit your own notes");
  }
  const updated = await expenseRepo.updateNote(noteId, input);
  if (!updated) notFound("Note not found");
  res.json(updated);
}));

router.delete(p(api.notes.delete.path), requireAuth, asyncHandler(async (req, res) => {
  const noteId = Number(req.params.noteId);
  const existing = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!existing[0]) notFound("Note not found");
  const participant = await participantRepo.getById(existing[0].participantId);
  if (!participant) notFound("Participant not found");
  await assertEventAccessOrThrow(req, participant.barbecueId);
  const userId = req.session!.userId!;
  if (participant.userId !== userId) {
    forbidden("Can only delete your own notes");
  }
  await expenseRepo.deleteNote(noteId);
  res.status(204).send();
}));

export default router;
