import { DashboardServerError } from "../access/errors";
import type { DashboardHandler } from "./handler";
import { errorResponse } from "./responses";

export interface CorsOptions {
  /** Exact HTTP(S) origins. Wildcards and opaque origins are not accepted. */
  origins: readonly string[];
  /** Allow cookies or browser HTTP authentication. Defaults to false. */
  credentials?: boolean;
  /** Additional request headers, e.g. a host's ticket header. */
  headers?: readonly string[];
}

const METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"];
const DEFAULT_HEADERS = ["authorization", "content-type", "if-match"];

export function validateCors(options: CorsOptions): void {
  for (const origin of options.origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`"${origin}" is not an HTTP(S) origin`);
    }
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin !== origin
    ) {
      throw new Error(
        `"${origin}" must be an exact origin, with no path, trailing slash ` +
          "or credentials",
      );
    }
  }
  for (const header of options.headers ?? []) {
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(header)) {
      throw new Error(`"${header}" is not an HTTP header name`);
    }
  }
}

/** Handles preflight before authentication; actual requests still use the handler. */
export function withCors(
  handler: DashboardHandler,
  options: CorsOptions,
): DashboardHandler {
  validateCors(options);
  const origins = new Set(options.origins);
  const headers = new Set([
    ...DEFAULT_HEADERS,
    ...(options.headers ?? []).map((h) => h.toLowerCase()),
  ]);

  return async (request) => {
    const origin = request.headers.get("origin");
    const preflight =
      request.method === "OPTIONS" &&
      request.headers.has("access-control-request-method");
    const requestedMethod =
      request.headers.get("access-control-request-method") ?? "";
    const requestedHeaders = (
      request.headers.get("access-control-request-headers") ?? ""
    )
      .split(",")
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    const allowed = origin !== null && origins.has(origin);
    // Only a preflight is refused. A preflight is the browser asking
    // permission, so a no belongs there — and every write to this API is
    // preflighted, because PUT and DELETE are, and so is any POST carrying
    // JSON or a credential header.
    //
    // An actual request is never refused on its Origin alone. Browsers send
    // Origin on every non-GET request including a same-origin one, so
    // refusing an unlisted origin here turns each configured deployment's own
    // front end, and its own /docs page, into a 403 the moment CORS is set.
    // Withholding the header below is what stops a cross-origin reader.
    const denied =
      preflight &&
      origin !== null &&
      (!allowed ||
        !METHODS.includes(requestedMethod) ||
        requestedHeaders.some((h) => !headers.has(h)));
    const response = denied
      ? errorResponse(
          new DashboardServerError(
            "FORBIDDEN",
            "Origin or preflight is not allowed",
          ),
        )
      : preflight && allowed
        ? new Response(null, { status: 204 })
        : await handler(request);
    // Clone headers: a mounted handler may return an immutable fetch response.
    const result = new Response(response.body, response);
    result.headers.append("Vary", "Origin");
    if (preflight)
      result.headers.append(
        "Vary",
        "Access-Control-Request-Method, Access-Control-Request-Headers",
      );
    if (!denied && allowed) {
      result.headers.set("Access-Control-Allow-Origin", origin);
      if (options.credentials)
        result.headers.set("Access-Control-Allow-Credentials", "true");
      result.headers.set("Access-Control-Expose-Headers", "ETag");
      if (preflight) {
        result.headers.set("Access-Control-Allow-Methods", METHODS.join(", "));
        result.headers.set(
          "Access-Control-Allow-Headers",
          [...headers].join(", "),
        );
        result.headers.set("Access-Control-Max-Age", "600");
      }
    }
    return result;
  };
}
