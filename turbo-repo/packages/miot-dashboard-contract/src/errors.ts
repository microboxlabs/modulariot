/**
 * The error envelope, and the codes that may appear in it.
 *
 * 403 carries a `reason`. `TENANT_SCOPE` is returned whether or not the scope
 * exists, so it cannot be used to discover what does.
 */

export type DashboardErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ForbiddenReason =
  /** The caller cannot reach the named scope, or has no membership in it. */
  | "TENANT_SCOPE"
  /** An embed principal reached outside the one dashboard its token names. */
  | "EMBED_SCOPE"
  /** In scope, but the effective capabilities do not include this action. */
  | "CAPABILITY";

/** The status each code is reported with. Every implementation uses these. */
export const STATUS_BY_CODE: Readonly<Record<DashboardErrorCode, number>> =
  Object.freeze({
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    CONFLICT: 409,
    PAYLOAD_TOO_LARGE: 413,
    UPSTREAM_ERROR: 502,
    INTERNAL_ERROR: 500,
  });

/** What goes on the wire. */
export interface ErrorEnvelope {
  /** Human-readable, safe to show; never contains credentials or stack text. */
  error: string;
  status: number;
  code: DashboardErrorCode;
  /** Present on 403 only. */
  reason?: ForbiddenReason;
}
