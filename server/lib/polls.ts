import { randomUUID } from "crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { barbecues, eventChatMessages, eventMembers, pollOptions, polls, pollVotes, users } from "@shared/schema";
import { serializeEventChatMessage, type EventChatMessage } from "./eventChatStore";
import { SYSTEM_USER_NAME } from "@shared/lib/system-user";

export type PollDetails = {
  poll: {
    id: string;
    eventId: number;
    messageId: string;
    createdByUserId: number;
    question: string;
    isClosed: boolean;
    createdAt: string | null;
  };
  options: Array<{
    id: string;
    label: string;
    position: number;
    voteCount: number;
    voters: Array<{
      id: number;
      name: string;
      avatarUrl: string | null;
    }>;
    isLeading: boolean;
    isWinner: boolean;
  }>;
  totalVotes: number;
  totalEligibleVoters: number | null;
  myVoteOptionId: string | null;
  permissions: {
    canVote: boolean;
    canClose: boolean;
  };
};

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export async function getPollById(pollId: string, viewerUserId?: number): Promise<PollDetails | null> {
  const [pollRow] = await db
    .select({
      id: polls.id,
      eventId: polls.eventId,
      messageId: polls.messageId,
      createdByUserId: polls.createdByUserId,
      question: polls.question,
      isClosed: polls.isClosed,
      createdAt: polls.createdAt,
      eventCreatorUserId: barbecues.creatorUserId,
    })
    .from(polls)
    .innerJoin(barbecues, eq(barbecues.id, polls.eventId))
    .where(eq(polls.id, pollId))
    .limit(1);
  if (!pollRow) return null;

  const optionRows = await db
    .select()
    .from(pollOptions)
    .where(eq(pollOptions.pollId, pollId))
    .orderBy(asc(pollOptions.position), asc(pollOptions.id));
  const voteRows = await db
    .select()
    .from(pollVotes)
    .where(eq(pollVotes.pollId, pollId));
  const voterUserIds = Array.from(new Set(voteRows.map((vote) => vote.userId).filter((id) => Number.isFinite(id))));
  const voterRows = voterUserIds.length > 0
    ? await db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        profileImageUrl: users.profileImageUrl,
      })
      .from(users)
      .where(inArray(users.id, voterUserIds))
    : [];
  const eligibleVoterRows = await db
    .select({ userId: eventMembers.userId })
    .from(eventMembers)
    .where(eq(eventMembers.eventId, pollRow.eventId));

  const voteCountByOptionId = new Map<string, number>();
  const votersByOptionId = new Map<string, Array<{ id: number; name: string; avatarUrl: string | null }>>();
  let myVoteOptionId: string | null = null;
  const voterById = new Map(voterRows.map((row) => [
    row.id,
    {
      id: row.id,
      name: row.displayName || row.username,
      avatarUrl: row.avatarUrl ?? row.profileImageUrl ?? null,
    },
  ]));
  for (const vote of voteRows) {
    voteCountByOptionId.set(vote.optionId, (voteCountByOptionId.get(vote.optionId) ?? 0) + 1);
    const voter = voterById.get(vote.userId);
    if (voter) {
      const voters = votersByOptionId.get(vote.optionId) ?? [];
      voters.push(voter);
      votersByOptionId.set(vote.optionId, voters);
    }
    if (viewerUserId && vote.userId === viewerUserId) myVoteOptionId = vote.optionId;
  }
  const totalVotes = voteRows.length;
  const highestVoteCount = optionRows.reduce((highest, option) => Math.max(highest, voteCountByOptionId.get(option.id) ?? 0), 0);
  const leadingOptions = optionRows.filter((option) => (voteCountByOptionId.get(option.id) ?? 0) === highestVoteCount && highestVoteCount > 0);
  const hasSingleLeader = leadingOptions.length === 1;

  const canClose = !!viewerUserId && (
    viewerUserId === pollRow.createdByUserId
    || viewerUserId === pollRow.eventCreatorUserId
  );

  return {
    poll: {
      id: pollRow.id,
      eventId: pollRow.eventId,
      messageId: pollRow.messageId,
      createdByUserId: pollRow.createdByUserId,
      question: pollRow.question,
      isClosed: pollRow.isClosed,
      createdAt: toIso(pollRow.createdAt),
    },
    options: optionRows.map((option) => ({
      id: option.id,
      label: option.label,
      position: option.position,
      voteCount: voteCountByOptionId.get(option.id) ?? 0,
      voters: votersByOptionId.get(option.id) ?? [],
      isLeading: hasSingleLeader && leadingOptions[0]?.id === option.id,
      isWinner: pollRow.isClosed && hasSingleLeader && leadingOptions[0]?.id === option.id,
    })),
    totalVotes,
    totalEligibleVoters: eligibleVoterRows.length,
    myVoteOptionId,
    permissions: {
      canVote: !pollRow.isClosed,
      canClose,
    },
  };
}

export async function createPoll(input: {
  eventId: number;
  userId: number;
  username: string;
  avatarUrl?: string | null;
  question: string;
  options: string[];
}): Promise<{ poll: PollDetails; message: EventChatMessage }> {
  const pollId = randomUUID();
  const messageId = randomUUID();
  const clientMessageId = randomUUID();
  const now = new Date();

  const [messageRow] = await db.transaction(async (tx) => {
    const [createdMessage] = await tx
      .insert(eventChatMessages)
      .values({
        id: messageId,
        eventId: input.eventId,
        authorUserId: null,
        authorName: SYSTEM_USER_NAME,
        authorAvatarUrl: null,
        clientMessageId,
        type: "system",
        content: input.question,
        metadata: {
          type: "poll",
          pollId,
          createdByUserId: input.userId,
          createdByName: input.username,
        },
        createdAt: now,
      })
      .returning();

    await tx.insert(polls).values({
      id: pollId,
      eventId: input.eventId,
      messageId,
      createdByUserId: input.userId,
      question: input.question,
      isClosed: false,
      createdAt: now,
    });

    await tx.insert(pollOptions).values(input.options.map((label, index) => ({
      id: randomUUID(),
      pollId,
      label,
      position: index,
    })));

    return [createdMessage];
  });

  if (!messageRow) throw new Error("Failed to create poll message");
  const poll = await getPollById(pollId, input.userId);
  if (!poll) throw new Error("Failed to load poll");
  return {
    poll,
    message: serializeEventChatMessage(messageRow, []),
  };
}

export async function voteOnPoll(input: {
  pollId: string;
  optionId: string;
  userId: number;
}): Promise<PollDetails | null> {
  const poll = await getPollById(input.pollId, input.userId);
  if (!poll || poll.poll.isClosed) return poll;
  const option = poll.options.find((row) => row.id === input.optionId);
  if (!option) throw new Error("Poll option not found");

  await db.insert(pollVotes).values({
    pollId: input.pollId,
    optionId: input.optionId,
    userId: input.userId,
    createdAt: new Date(),
  }).onConflictDoUpdate({
    target: [pollVotes.pollId, pollVotes.userId],
    set: {
      optionId: input.optionId,
      createdAt: new Date(),
    },
  });

  return getPollById(input.pollId, input.userId);
}

export async function closePoll(pollId: string): Promise<void> {
  await db
    .update(polls)
    .set({ isClosed: true })
    .where(eq(polls.id, pollId));
}

export async function getPollEventContext(pollId: string): Promise<{
  eventId: number;
  createdByUserId: number;
  eventCreatorUserId: number | null;
  isClosed: boolean;
} | null> {
  const [row] = await db
    .select({
      eventId: polls.eventId,
      createdByUserId: polls.createdByUserId,
      eventCreatorUserId: barbecues.creatorUserId,
      isClosed: polls.isClosed,
    })
    .from(polls)
    .innerJoin(barbecues, eq(barbecues.id, polls.eventId))
    .where(eq(polls.id, pollId))
    .limit(1);
  return row ?? null;
}
