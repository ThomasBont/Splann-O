/**
 * Authorization helpers for user-owned resources.
 * Barbecues are scoped by creatorId (username); participants can access if they're members.
 */

import type { Barbecue } from "@shared/schema";
import type { IStorage } from "../storage";

/** Throws if user cannot access barbecue (404 or 403). Returns bbq if ok. */
export async function assertCanAccessBarbecue(
  storage: IStorage,
  barbecueId: number,
  currentUsername: string | undefined
): Promise<Barbecue> {
  const bbq = await storage.getBarbecue(barbecueId);
  if (!bbq) throw new AuthzError(404, "Event not found");
  if (!currentUsername) throw new AuthzError(401, "Not authenticated");

  if (bbq.creatorId === currentUsername) return bbq;
  const participants = await storage.getParticipants(barbecueId);
  const isParticipant = participants.some((p) => p.userId === currentUsername);
  if (isParticipant) return bbq;

  throw new AuthzError(403, "Access denied");
}

/** Throws if user is not the creator. Returns bbq if ok. */
export async function assertIsCreator(
  storage: IStorage,
  barbecueId: number,
  currentUsername: string | undefined
): Promise<Barbecue> {
  const bbq = await storage.getBarbecue(barbecueId);
  if (!bbq) throw new AuthzError(404, "Event not found");
  if (!currentUsername) throw new AuthzError(401, "Not authenticated");
  if (bbq.creatorId !== currentUsername) throw new AuthzError(403, "Only the creator can perform this action");
  return bbq;
}

export class AuthzError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "AuthzError";
  }
}
