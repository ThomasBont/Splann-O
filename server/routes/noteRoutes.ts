// Notes routes for event notes CRUD.
import { Router } from "express";
import { eq } from "drizzle-orm";
import { api } from "@shared/routes";
import { notes } from "@shared/schema";
import { expenseRepo } from "../repositories/expenseRepo";
import { participantRepo } from "../repositories/participantRepo";
import { db } from "../db";
import { forbidden, notFound } from "../lib/errors";
import { asyncHandler, getBarbecueOr404, p } from "./_helpers";

const router = Router();

router.get(p(api.notes.list.path), asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const bbq = await getBarbecueOr404(req, eventId);
  const items = await expenseRepo.getNotes(bbq.id);
  res.json(items);
}));

router.post(p(api.notes.create.path), asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  await getBarbecueOr404(req, eventId);
  const input = api.notes.create.input.parse(req.body);
  const participant = await participantRepo.getById(input.participantId);
  if (!participant || participant.barbecueId !== eventId) {
    forbidden("Invalid participant for this event");
  }
  const created = await expenseRepo.createNote({
    barbecueId: eventId,
    participantId: input.participantId,
    title: input.title ?? null,
    body: input.body,
    pinned: input.pinned ?? false,
  });
  res.status(201).json(created);
}));

router.patch(p(api.notes.update.path), asyncHandler(async (req, res) => {
  const noteId = Number(req.params.noteId);
  const input = api.notes.update.input.parse(req.body);
  const existing = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!existing[0]) notFound("Note not found");
  const participant = await participantRepo.getById(existing[0].participantId);
  const userId = req.session?.userId;
  if (userId && participant?.userId && participant.userId !== userId) {
    forbidden("Can only edit your own notes");
  }
  const updated = await expenseRepo.updateNote(noteId, input);
  if (!updated) notFound("Note not found");
  res.json(updated);
}));

router.delete(p(api.notes.delete.path), asyncHandler(async (req, res) => {
  const noteId = Number(req.params.noteId);
  const existing = await db.select().from(notes).where(eq(notes.id, noteId));
  if (!existing[0]) notFound("Note not found");
  const participant = await participantRepo.getById(existing[0].participantId);
  const userId = req.session?.userId;
  if (userId && participant?.userId && participant.userId !== userId) {
    forbidden("Can only delete your own notes");
  }
  await expenseRepo.deleteNote(noteId);
  res.status(204).send();
}));

export default router;
