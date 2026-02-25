import { bbqRepo } from "../repositories/bbqRepo";
import { participantRepo } from "../repositories/participantRepo";
import { userRepo } from "../repositories/userRepo";
import { getLimits } from "../lib/plan";
import { upgradeRequired } from "../lib/errors";
import { auditLog } from "../lib/audit";
import type { Barbecue } from "@shared/schema";

export async function listBarbecues(currentUsername?: string, currentUserId?: number): Promise<Barbecue[]> {
  return bbqRepo.listAccessible(currentUsername, currentUserId);
}

export async function listPublicBarbecues(): Promise<Barbecue[]> {
  return bbqRepo.listPublic();
}

export async function createBarbecue(
  input: {
    name: string;
    date: Date | string;
    currency?: string;
    creatorId?: string | null;
    isPublic?: boolean;
    allowOptInExpenses?: boolean;
    area?: string;
    eventType?: string;
  },
  sessionUsername?: string
): Promise<Barbecue> {
  const creatorId = input.creatorId?.trim() || sessionUsername;
  if (creatorId) {
    const creatorUser = await userRepo.findByUsername(creatorId);
    const limits = getLimits(creatorUser ?? undefined);
    const count = await bbqRepo.countOwnedByCreator(creatorId);
    if (count >= limits.maxEvents) upgradeRequired("more_events", { current: count, max: limits.maxEvents });
  }

  const created = await bbqRepo.create({
    ...input,
    date: typeof input.date === "string" ? new Date(input.date) : input.date,
  } as Parameters<typeof bbqRepo.create>[0]);

  if (creatorId) {
    await participantRepo.create({
      barbecueId: created.id,
      name: creatorId,
      userId: creatorId,
      status: "accepted",
    });
  }
  auditLog("barbecue.create", { barbecueId: created.id, username: sessionUsername });
  return created;
}

export async function getBarbecueIfAccessible(
  bbqId: number,
  userId?: number,
  username?: string
): Promise<Barbecue | null> {
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) return null;
  const hasAccess = await bbqRepo.hasAccess(bbq, username, userId);
  return hasAccess ? bbq : null;
}
