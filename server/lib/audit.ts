/**
 * Audit logging for critical actions.
 * Structured for future swap to a log provider (e.g. Datadog, Axiom).
 *
 * Lightweight format for security events: [AUDIT] action=<action> user=<id|unknown> ip=<ip>
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
  | "password_reset.used"
  | "login.success"
  | "login.failure"
  | "password_reset.request"
  | "event.lock"
  | "plan.change";

export interface AuditPayload {
  userId?: number;
  username?: string;
  barbecueId?: number;
  participantId?: number;
  expenseId?: number;
  [key: string]: unknown;
}

/** Lightweight security audit: [AUDIT] action= user= ip= — no passwords/tokens. */
export function auditSecurity(
  action: string,
  opts: { user?: string | number; ip?: string } = {}
): void {
  const user = opts.user ?? "unknown";
  const ip = opts.ip ?? "unknown";
  console.log(`[AUDIT] action=${action} user=${user} ip=${ip}`);
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
