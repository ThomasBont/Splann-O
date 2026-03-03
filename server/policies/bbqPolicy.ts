import { bbqRepo } from "../repositories/bbqRepo";
import { forbidden, notFound } from "../lib/errors";

export async function assertCanAccessBbq(userId: number | undefined, username: string | undefined, bbqId: number): Promise<void> {
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) throw notFound("BBQ not found");
  const hasAccess = await bbqRepo.hasAccess(bbq, username ?? undefined, userId);
  if (!hasAccess) throw forbidden("You do not have access to this event");
}

export async function assertIsBbqOwner(userId: number, bbqId: number): Promise<void> {
  const bbq = await bbqRepo.getById(bbqId);
  if (!bbq) throw notFound("BBQ not found");
  if (bbq.creatorUserId !== userId) throw forbidden("Only the creator can perform this action");
}
