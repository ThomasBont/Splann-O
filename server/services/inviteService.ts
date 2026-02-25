import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { getLimits } from "../lib/plan";
import { upgradeRequired, notFound, forbidden, conflict } from "../lib/errors";
import type { Participant } from "@shared/schema";

export async function inviteByUsername(bbqId: number, username: string, inviterUsername: string): Promise<Participant> {
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) notFound("Event not found");
  if (bbq.creatorId !== inviterUsername) forbidden("Only the creator can invite");

  const creatorUser = bbq.creatorId ? await userRepo.findByUsername(bbq.creatorId) : undefined;
  const limits = getLimits(creatorUser ?? undefined);
  const participantCount = await participantRepo.countByBbq(bbqId);
  if (participantCount >= limits.maxParticipantsPerEvent)
    upgradeRequired("more_participants", { current: participantCount, max: limits.maxParticipantsPerEvent });

  const targetUser = await userRepo.findByUsername(username);
  if (!targetUser) notFound("User not found");
  const existing = await participantRepo.getMemberships(username);
  const alreadyIn = existing.find((m) => m.bbqId === bbqId);
  if (alreadyIn) conflict("already_member");

  return participantRepo.inviteUser(bbqId, username, targetUser.id);
}
