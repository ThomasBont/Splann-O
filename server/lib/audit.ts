/**
 * Audit logging for critical actions.
 * Structured for future swap to a log provider (e.g. Datadog, Axiom).
 */

export type AuditAction =
  | "barbecue.create"
  | "barbecue.update"
  | "barbecue.delete"
  | "barbecue.settle_up"
  | "expense.create"
  | "expense.delete"
  | "participant.add"
  | "participant.remove"
  | "participant.accept"
  | "participant.reject"
  | "password_reset.used";

export interface AuditPayload {
  userId?: number;
  username?: string;
  barbecueId?: number;
  participantId?: number;
  expenseId?: number;
  [key: string]: unknown;
}

/** Log structured audit event. Console for now; can be swapped to external provider. */
export function auditLog(action: AuditAction, payload: AuditPayload): void {
  const entry = {
    at: new Date().toISOString(),
    action,
    ...payload,
  };
  console.log("[audit]", JSON.stringify(entry));
}
