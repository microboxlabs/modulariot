/**
 * The one error shape this package reports.
 *
 * Every adapter serializes a `DashboardServerError` the same way, so a host
 * mounting the package under Next, Fastify or anything else exposes one
 * envelope. The shape is a superset of what apps/app already returns from
 * its dashboard routes (`{ error, status, code? }`), so the P2 strangle
 * changes nothing a client can observe.
 *
 * 403 carries a `reason` so a caller can tell "you are outside this scope"
 * from "you are in the scope but may not do this" — the UI hides an edit
 * button for the second and shows nothing at all for the first. The first is
 * deliberately the same response whether or not the scope exists: it is
 * produced before any store call, so it cannot act as an existence oracle.
 */

export type DashboardErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "UPSTREAM_ERROR"
  | "INTERNAL_ERROR";

export type ForbiddenReason =
  /** The credential's tenant cannot reach the named scope, or has no membership in it. */
  | "TENANT_SCOPE"
  /** An embed principal reached outside the one dashboard its token names. */
  | "EMBED_SCOPE"
  /** In scope, but the effective capabilities do not include this action. */
  | "CAPABILITY";

export const STATUS_BY_CODE: Readonly<Record<DashboardErrorCode, number>> =
  Object.freeze({
    UNAUTHENTICATED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    BAD_REQUEST: 400,
    CONFLICT: 409,
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

export class DashboardServerError extends Error {
  readonly code: DashboardErrorCode;
  readonly status: number;
  readonly reason?: ForbiddenReason;

  constructor(
    code: DashboardErrorCode,
    message: string,
    options: { reason?: ForbiddenReason; cause?: unknown } = {},
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = "DashboardServerError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    if (options.reason !== undefined) this.reason = options.reason;
  }

  toEnvelope(): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
      error: this.message,
      status: this.status,
      code: this.code,
    };
    if (this.reason !== undefined) envelope.reason = this.reason;
    return envelope;
  }

  static unauthenticated(
    message = "Authentication required",
  ): DashboardServerError {
    return new DashboardServerError("UNAUTHENTICATED", message);
  }

  static forbidden(
    reason: ForbiddenReason,
    message: string,
  ): DashboardServerError {
    return new DashboardServerError("FORBIDDEN", message, { reason });
  }

  static notFound(message = "Not found"): DashboardServerError {
    return new DashboardServerError("NOT_FOUND", message);
  }

  static badRequest(message: string): DashboardServerError {
    return new DashboardServerError("BAD_REQUEST", message);
  }

  static conflict(message: string): DashboardServerError {
    return new DashboardServerError("CONFLICT", message);
  }
}

export function isDashboardServerError(
  error: unknown,
): error is DashboardServerError {
  return error instanceof DashboardServerError;
}

/**
 * Envelope for anything thrown. A `DashboardServerError` serializes itself;
 * everything else becomes a generic 500. The original message is dropped on
 * purpose — an upstream exception is the most likely place for a connection
 * string or token to surface, and this is the last line before the wire.
 */
export function toErrorEnvelope(error: unknown): ErrorEnvelope {
  if (isDashboardServerError(error)) return error.toEnvelope();
  return {
    error: "An unexpected error occurred",
    status: STATUS_BY_CODE.INTERNAL_ERROR,
    code: "INTERNAL_ERROR",
  };
}
