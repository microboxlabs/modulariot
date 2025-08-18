import { FetcherError } from "./fetcher.types";
import { apiLogger, logError } from "@/lib/logger";
import {
  buildAccessLogFields,
  generateRequestId,
} from "@/features/common/utils/access-log";

// moved const shouldLog =
const shouldLog =
  typeof window === "undefined" && process.env.LOG_ACCESS === "true";
// Type guard for Request
const isRequest = (value: unknown): value is Request =>
  typeof Request !== "undefined" && value instanceof Request;

// Extracts path+query and upstream host from the input
const parseTarget = (
  input: RequestInfo | URL
): { pathAndQuery: string; upstreamHost: string } => {
  // URL instance
  if (typeof URL !== "undefined" && input instanceof URL) {
    return {
      pathAndQuery: `${input.pathname}${input.search}` || "/",
      upstreamHost: input.hostname || "-",
    };
  }

  // String URL (absolute or relative)
  if (typeof input === "string") {
    try {
      const u = new URL(input);
      return {
        pathAndQuery: `${u.pathname}${u.search}` || "/",
        upstreamHost: u.hostname || "-",
      };
    } catch {
      // Relative URL, keep as-is
      return { pathAndQuery: input, upstreamHost: "-" };
    }
  }

  // Request object
  if (isRequest(input)) {
    try {
      const u = new URL(input.url);
      return {
        pathAndQuery: `${u.pathname}${u.search}` || "/",
        upstreamHost: u.hostname || "-",
      };
    } catch {
      return { pathAndQuery: input.url, upstreamHost: "-" };
    }
  }

  return { pathAndQuery: "-", upstreamHost: "-" };
};

// Merge headers from a Request and/or init headers into a new Headers instance
const buildMergedHeaders = (
  base: RequestInfo | URL,
  override?: HeadersInit
): Headers => {
  const merged = new Headers(isRequest(base) ? base.headers : undefined);
  if (override) {
    const overrideHeaders = new Headers(override);
    overrideHeaders.forEach((value, key) => merged.set(key, value));
  }
  if (!merged.has("content-type")) {
    merged.set("Content-Type", "application/json");
  }
  return merged;
};

export default async function httfetcher<T>(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const method = (init?.method || "GET").toUpperCase();
  const { pathAndQuery, upstreamHost } = parseTarget(input);

  // Prepare headers and request id for correlation
  const headers = buildMergedHeaders(input, init?.headers);
  let requestId = headers.get("x-request-id") || generateRequestId();
  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", requestId);
  }

  // Capture user agent if provided in init headers
  const userAgent = headers.get("user-agent") || "-";

  const startTime = Date.now();
  const startedAt = new Date();

  let response: Response | undefined;
  try {
    response = await fetch(input as Request | string | URL, {
      ...init,
      headers,
    });

    const durationMs = Date.now() - startTime;
    const status = response.status;
    const contentLength = response.headers.get("content-length") || "-";

    if (shouldLog) {
      apiLogger.info(
        buildAccessLogFields({
          prefix: "OUT",
          method,
          pathAndQuery,
          status,
          contentLength,
          userAgent,
          startedAt,
          durationMs,
          requestId,
          extras: { upstream_host: upstreamHost },
        })
      );
    }

    if (!response.ok) {
      const error = new Error(response.statusText) as FetcherError;
      error.status = response.status;

      // Try to parse error response as JSON, but handle cases where there's no body
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        error.info = await response.text();
      } catch (err) {
        console.error("error response", err);
        error.info = null;
      }

      if (shouldLog) {
        logError(error, {
          ...buildAccessLogFields({
            prefix: "OUT",
            method,
            pathAndQuery,
            status: response.status,
            contentLength,
            userAgent,
            startedAt,
            durationMs,
            requestId,
            extras: { upstream_host: upstreamHost },
          }),
        });
      }

      throw error;
    }

    // Handle 204 No Content and other responses with no body
    if (response.status === 204) {
      console.log("undefined response", response);
      return null as T;
    }

    /* if (response.headers.get("content-type")?.includes("application/json")) {
      console.error("content-type is not application/json");
      return response.text() as T;
    } */

    return (await response.json()) as T;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const status = response?.status ?? 0;
    const contentLength = response?.headers.get("content-length") || "-";
    console.error("error response", await response?.text());
    if (shouldLog) {
      apiLogger.error({
        ...buildAccessLogFields({
          prefix: "OUT",
          method,
          pathAndQuery,
          status,
          contentLength,
          userAgent,
          startedAt,
          durationMs,
          requestId,
          extras: { upstream_host: upstreamHost },
        }),
        err,
      });
    }
    throw err;
  }
}
