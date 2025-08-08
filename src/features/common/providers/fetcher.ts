import { FetcherError } from "./fetcher.types";
import { apiLogger } from "@/lib/logger";

// Generate a lightweight request id suitable for correlation when none is provided
const generateRequestId = (): string =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

// Format date similar to nginx combined log time local: 08/Aug/2025:13:46:51 +0000
const formatAccessLogDate = (date: Date): string => {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${day}/${month}/${year}:${hours}:${minutes}:${seconds} +0000`;
};

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
    const durationSec = (durationMs / 1000).toFixed(3);
    const status = response.status;
    const contentLength = response.headers.get("content-length") || "-";

    if (shouldLog) {
      const formatted = `OUT - - - [${formatAccessLogDate(
        startedAt,
      )}] "${method} ${pathAndQuery} HTTP/1.1" ${status} ${contentLength} "-" "${userAgent}" upstream_host=${upstreamHost} duration_ms=${durationMs} duration_s=${durationSec} request_id=${requestId}`;

      apiLogger.info(
        {
          direction: "outbound",
          method,
          url: pathAndQuery,
          status,
          contentLength,
          userAgent,
          upstreamHost,
          durationMs,
          durationSec,
          requestId,
        },
        formatted,
      );
    }

    if (!response.ok) {
      const error = new Error(response.statusText) as FetcherError;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      error.info = await response.json();
      error.status = response.status;

      if (shouldLog) {
        const formatted = `OUT - - - [${formatAccessLogDate(
          startedAt,
        )}] "${method} ${pathAndQuery} HTTP/1.1" ${response.status} ${contentLength} "-" "${userAgent}" upstream_host=${upstreamHost} duration_ms=${durationMs} duration_s=${durationSec} request_id=${requestId}`;
        apiLogger.error(
          {
            direction: "outbound",
            method,
            url: pathAndQuery,
            status: response.status,
            contentLength,
            userAgent,
            upstreamHost,
            durationMs,
            durationSec,
            requestId,
            err: error,
          },
          formatted,
        );
      }

      throw error;
    }

    return (await response.json()) as T;
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(3);
    const status = response?.status ?? 0;
    const contentLength = response?.headers.get("content-length") || "-";

    if (shouldLog) {
      const formatted = `OUT - - - [${formatAccessLogDate(
        startedAt,
      )}] "${method} ${pathAndQuery} HTTP/1.1" ${status} ${contentLength} "-" "${userAgent}" upstream_host=${upstreamHost} duration_ms=${durationMs} duration_s=${durationSec} request_id=${requestId}`;

      apiLogger.error(
        {
          direction: "outbound",
          method,
          url: pathAndQuery,
          status,
          contentLength,
          userAgent,
          upstreamHost,
          durationMs,
          durationSec,
          requestId,
          err,
        },
        formatted,
      );
    }
    throw err;
  }
}
