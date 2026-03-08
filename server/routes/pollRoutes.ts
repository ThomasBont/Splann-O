import { Router } from "express";
import { z } from "zod";
import { broadcastEventRealtime } from "../lib/eventRealtime";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";
import { logPlanActivity } from "../lib/planActivity";
import { requireAuth } from "../middleware/requireAuth";
import { assertEventAccessOrThrow, asyncHandler } from "./_helpers";
import { closePoll, createPoll, getPollById, getPollEventContext, voteOnPoll } from "../lib/polls";

const router = Router();

const createPollSchema = z.object({
  question: z.string().trim().min(1).max(240),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
});

async function handleCreatePoll(req: any, res: any) {
  const rawEventId = req.params.eventId ?? req.params.planId;
  const eventId = Number(rawEventId);
  if (!Number.isInteger(eventId) || eventId <= 0) badRequest("Invalid event id");
  await assertEventAccessOrThrow(req, eventId);
  const userId = req.session?.userId;
  const username = req.session?.username;
  if (!userId || !username) unauthorized("Not authenticated");

  const parsed = createPollSchema.parse(req.body ?? {});
  const dedupedOptions = parsed.options
    .map((option) => option.trim())
    .filter(Boolean)
    .filter((option, index, list) => list.findIndex((candidate) => candidate.toLowerCase() === option.toLowerCase()) === index);
  if (dedupedOptions.length < 2) badRequest("At least 2 unique options are required");

  const created = await createPoll({
    eventId,
    userId,
    username,
    question: parsed.question,
    options: dedupedOptions,
  });

  await logPlanActivity({
    eventId,
    type: "POLL_CREATED",
    actorUserId: userId,
    actorName: username,
    message: `${username} started a vote: ${parsed.question}`,
    meta: {
      pollId: created.poll.poll.id,
      question: created.poll.poll.question,
      optionCount: created.poll.options.length,
    },
  });

  broadcastEventRealtime(eventId, {
    type: "chat:new",
    eventId,
    message: created.message,
  });

  res.status(201).json(created);
}

router.post("/events/:eventId/polls", requireAuth, asyncHandler(handleCreatePoll));
router.post("/plans/:planId/polls", requireAuth, asyncHandler(handleCreatePoll));

router.get("/polls/:pollId", requireAuth, asyncHandler(async (req, res) => {
  const pollId = String(req.params.pollId ?? "").trim();
  if (!pollId) badRequest("Invalid poll id");
  const context = await getPollEventContext(pollId);
  if (!context) notFound("Poll not found");
  await assertEventAccessOrThrow(req, context.eventId);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const poll = await getPollById(pollId, userId);
  if (!poll) notFound("Poll not found");
  res.json(poll);
}));

router.post("/polls/:pollId/vote", requireAuth, asyncHandler(async (req, res) => {
  const pollId = String(req.params.pollId ?? "").trim();
  if (!pollId) badRequest("Invalid poll id");
  const context = await getPollEventContext(pollId);
  if (!context) notFound("Poll not found");
  await assertEventAccessOrThrow(req, context.eventId);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  if (context.isClosed) {
    res.status(409).json({ code: "poll_closed", message: "This poll is closed." });
    return;
  }

  const parsed = z.object({
    optionId: z.string().trim().uuid(),
  }).parse(req.body ?? {});

  const previousPoll = await getPollById(pollId, userId);
  const poll = await voteOnPoll({
    pollId,
    optionId: parsed.optionId,
    userId,
  });
  if (!poll) notFound("Poll not found");
  const votedOption = poll.options.find((option) => option.id === parsed.optionId);
  const previousOption = previousPoll?.options.find((option) => option.id === previousPoll.myVoteOptionId);
  const actorName = req.session?.username ?? "Someone";
  await logPlanActivity({
    eventId: context.eventId,
    type: "POLL_VOTED",
    actorUserId: userId,
    actorName,
    message: previousOption && previousOption.id !== parsed.optionId
      ? `${actorName} changed vote to ${votedOption?.label ?? "an option"}`
      : `${actorName} voted for ${votedOption?.label ?? "an option"}`,
    meta: {
      pollId: poll.poll.id,
      question: poll.poll.question,
      optionId: parsed.optionId,
      optionLabel: votedOption?.label ?? null,
      previousOptionId: previousOption?.id ?? null,
      previousOptionLabel: previousOption?.label ?? null,
    },
  });
  res.json(poll);
}));

router.post("/polls/:pollId/close", requireAuth, asyncHandler(async (req, res) => {
  const pollId = String(req.params.pollId ?? "").trim();
  if (!pollId) badRequest("Invalid poll id");
  const context = await getPollEventContext(pollId);
  if (!context) notFound("Poll not found");
  await assertEventAccessOrThrow(req, context.eventId);
  const userId = req.session?.userId;
  if (!userId) unauthorized("Not authenticated");
  const canClose = userId === context.createdByUserId || userId === context.eventCreatorUserId;
  if (!canClose) forbidden("Only the poll creator or event creator can close this poll");

  await closePoll(pollId);
  const poll = await getPollById(pollId, userId);
  if (!poll) notFound("Poll not found");
  await logPlanActivity({
    eventId: context.eventId,
    type: "POLL_CLOSED",
    actorUserId: userId,
    actorName: req.session?.username ?? "Someone",
    message: `${req.session?.username ?? "Someone"} closed the vote: ${poll.poll.question}`,
    meta: {
      pollId: poll.poll.id,
      question: poll.poll.question,
      totalVotes: poll.totalVotes,
      winnerOptionId: poll.options.find((option) => option.isWinner)?.id ?? null,
      winnerOptionLabel: poll.options.find((option) => option.isWinner)?.label ?? null,
    },
  });
  res.json(poll);
}));

export default router;
