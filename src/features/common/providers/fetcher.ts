import { FetcherError, FetcherErrorCode } from "./fetcher.types";
import { apiLogger, logError } from "@/lib/logger";
import {
  buildAccessLogFields,
  generateRequestId,
} from "@/features/common/utils/access-log";

/**
 * Checks if the response content-type indicates JSON
 */
const isJsonContentType = (response: Response): boolean => {
  const contentType = response.headers.get("content-type");
  return contentType?.includes("application/json") ?? false;
};

/**
 * Creates a FetcherError with proper structure
 */
const createFetcherError = (
  message: string,
  status: number,
  code: string,
  info?: unknown
): FetcherError => {
  const error = new Error(message) as FetcherError;
  error.status = status;
  error.code = code;
  error.info = info;
  return error;
};

/**
 * Attempts to parse JSON response, handling non-JSON responses gracefully
 */
const parseJsonResponse = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("content-type");

  // If content-type is not JSON, this is likely an error page (HTML timeout, gateway error, etc.)
  if (!isJsonContentType(response)) {
    const text = await response.text();
    const isHtml = text.trim().startsWith("<") || contentType?.includes("html");

    // Detect common error patterns
    let errorMessage = "Server returned an unexpected response format";
    if (isHtml) {
      // Check for common timeout/gateway error indicators
      if (
        text.toLowerCase().includes("timeout") ||
        text.toLowerCase().includes("timed out")
      ) {
        errorMessage = "The request timed out. Please try again.";
      } else if (
        text.toLowerCase().includes("502") ||
        text.toLowerCase().includes("bad gateway")
      ) {
        errorMessage = "Service temporarily unavailable. Please try again.";
      } else if (
        text.toLowerCase().includes("503") ||
        text.toLowerCase().includes("service unavailable")
      ) {
        errorMessage = "Service temporarily unavailable. Please try again.";
      } else if (
        text.toLowerCase().includes("504") ||
        text.toLowerCase().includes("gateway timeout")
      ) {
        errorMessage = "The service took too long to respond. Please try again.";
      } else {
        errorMessage = "Service unavailable. Please try again later.";
      }
    }

    throw createFetcherError(
      errorMessage,
      response.status || 502,
      FetcherErrorCode.INVALID_RESPONSE_FORMAT,
      { contentType, responsePreview: text.substring(0, 200) }
    );
  }

  // Try to parse JSON
  try {
    return (await response.json()) as T;
  } catch (parseError) {
    // JSON parsing failed - this shouldn't happen if content-type was JSON
    // but handle it gracefully anyway
    throw createFetcherError(
      "Failed to parse server response",
      response.status || 500,
      FetcherErrorCode.JSON_PARSE_ERROR,
      { parseError: parseError instanceof Error ? parseError.message : String(parseError) }
    );
  }
};

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

  /*
  if (!merged.has("content-type")) {
    merged.set("Content-Type", "application/json");
  }
  */

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

    if (!response.ok && response.status !== 401) {
      const error = new Error(response.statusText) as FetcherError;
      error.status = response.status;
      // Try to parse error response as JSON, but handle cases where there's no body
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        error.info = await response.text();
      } catch (err) {
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
      return null as T;
    }

    // Parse JSON response with proper error handling for non-JSON responses
    return await parseJsonResponse<T>(response);
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

    // If it's already a FetcherError, re-throw it
    if (err instanceof Error && "code" in err && "status" in err) {
      throw err;
    }

    // Handle network-level errors (timeout, connection refused, etc.)
    if (err instanceof Error) {
      const errorMessage = err.message.toLowerCase();
      const errorCause =
        err.cause && typeof err.cause === "object" && "code" in err.cause
          ? (err.cause as { code: string }).code
          : "";

      // Check for timeout errors
      if (
        errorMessage.includes("timeout") ||
        errorMessage.includes("timed out") ||
        errorCause === "ETIMEDOUT" ||
        errorCause === "UND_ERR_CONNECT_TIMEOUT"
      ) {
        throw createFetcherError(
          "The request timed out. Please try again.",
          504,
          FetcherErrorCode.NETWORK_ERROR,
          { originalError: err.message }
        );
      }

      // Check for connection errors
      if (
        errorMessage.includes("econnrefused") ||
        errorMessage.includes("enotfound") ||
        errorMessage.includes("network") ||
        errorCause === "ECONNREFUSED" ||
        errorCause === "ENOTFOUND"
      ) {
        throw createFetcherError(
          "Unable to connect to the server. Please try again.",
          503,
          FetcherErrorCode.NETWORK_ERROR,
          { originalError: err.message }
        );
      }

      // Check for abort/cancel errors
      if (
        errorMessage.includes("aborted") ||
        err.name === "AbortError"
      ) {
        throw createFetcherError(
          "The request was cancelled.",
          499,
          FetcherErrorCode.NETWORK_ERROR,
          { originalError: err.message }
        );
      }
    }

    throw err;
  }
}
