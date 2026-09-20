/**
 * Reporting failures in the one shape the contract defines.
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

// The envelope, its codes and their statuses are what a client parses, so all
// three live in the contract. What stays here is this package's behaviour:
// the error class, and the reduction of a foreign error to a generic 500.
import {
  type DashboardErrorCode,
  type ErrorEnvelope,
  type ForbiddenReason,
  STATUS_BY_CODE,
} from "@microboxlabs/miot-dashboard-contract/errors";

export {
  type DashboardErrorCode,
  type ErrorEnvelope,
  type ForbiddenReason,
  STATUS_BY_CODE,
} from "@microboxlabs/miot-dashboard-contract/errors";

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

  /**
   * A body larger than an adapter is willing to buffer. Its own code rather
   * than a 400, because the caller's remedy is different: nothing about the
   * request was malformed, there was simply too much of it.
   */
  static payloadTooLarge(message: string): DashboardServerError {
    return new DashboardServerError("PAYLOAD_TOO_LARGE", message);
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
