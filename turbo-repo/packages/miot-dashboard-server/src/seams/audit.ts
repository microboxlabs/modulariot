/**
 * Audit seam — the record of who did what.
 *
 * Kept as a seam rather than a built-in log because hosts have opinions about
 * where audit lands (a table, a SIEM, an append-only bucket) and because a
 * dropped audit write must never fail the operation it was describing.
 *
 * Denied attempts are recorded, not only successful ones: a tenant-escape
 * attempt that returns 403 is exactly the event worth keeping.
 */

export type AuditAction =
  | "dashboard.load"
  | "dashboard.save"
  | "dashboard.delete"
  | "dashboard.permissions.read"
  | "dashboard.permissions.write"
  | "datasource.query"
  | "datasource.write"
  | "embed.token.issue"
  | "embed.token.redeem";

export type AuditOutcome = "allowed" | "denied" | "error";

export interface AuditEvent {
  /** ISO-8601, stamped by the caller so ordering survives an async sink. */
  at: string;
  /**
   * Absent when the request never resolved to an identity — a 401, or an
   * embed token that failed to verify. Those are precisely the attempts worth
   * recording, so the type must not force a caller to invent values to record
   * them. An absent tenantId means "unknown", never "any".
   */
  tenantId?: string;
  userId?: string;
  action: AuditAction;
  outcome: AuditOutcome;
  /** What was acted on: `scopeId/slug`, or a datasource id. */
  target: string;
  /** Non-sensitive detail only — never credentials, never full query rows. */
  detail?: Record<string, string | number | boolean>;
}

export interface AuditSink {
  /**
   * Record one event. Implementations should not throw: an audit backend
   * being down is not a reason to fail a user's dashboard load. Callers in
   * this package treat a rejection as swallowed-and-logged.
   */
  record(event: AuditEvent): Promise<void> | void;
}

/** Discards everything. The default, so audit is opt-in rather than a hard dependency. */
export const noopAuditSink: AuditSink = {
  record() {},
};
