import { FetcherError } from "./fetcher.types";
import { apiLogger } from "@/lib/logger";
import {
  buildAccessLogFields,
  generateRequestId,
} from "@/features/common/utils/access-log";

// moved to common utils

// Type guard for Request
const isRequest = (value: unknown): value is Request =>
  typeof Request !== "undefined" && value instanceof Request;

// Extracts path+query and upstream host from the input
const parseTarget = (
  input: RequestInfo | URL,
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
  override?: HeadersInit,
): Headers => {
  const merged = new Headers(isRequest(base) ? base.headers : undefined);
  if (override) {
    const overrideHeaders = new Headers(override);
    overrideHeaders.forEach((value, key) => merged.set(key, value));
  }
  return merged;
};

export default async function httfetcher<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const shouldLog =
    typeof window === "undefined" && process.env.LOG_ACCESS === "true";

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
        }),
      );
    }

    if (!response.ok) {
      const error = new Error(response.statusText) as FetcherError;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      error.info = await response.json();
      error.status = response.status;

      if (shouldLog) {
        apiLogger.error({
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
          err: error,
        });
      }

      throw error;
    }

    return (await response.json()) as T;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const status = response?.status ?? 0;
    const contentLength = response?.headers.get("content-length") || "-";

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
