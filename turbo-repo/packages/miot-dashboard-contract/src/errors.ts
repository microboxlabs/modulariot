/**
 * The error envelope, and the codes that may appear in it.
 *
 * One shape for every failure, whatever implements the API. A client written
 * against this does not have to learn a second error format when the server
 * behind it is replaced.
 *
 * 403 carries a `reason` so a caller can tell "you are outside this scope"
 * from "you are in the scope but may not do this". A renderer hides an edit
 * button for the second and shows nothing at all for the first. The first is
 * deliberately the same response whether or not the scope exists, so it
 * cannot be used to discover what does.
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

/**
 * The status each code is reported with. Fixed rather than left to the
 * implementation: a client that retries on 409 and gives up on 400 needs the
 * two to mean the same thing everywhere.
 */
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
