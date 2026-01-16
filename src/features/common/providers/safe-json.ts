"use client";

import {
  FetcherError,
  FetcherErrorCode,
  FetcherErrorInfo,
} from "./fetcher.types";

/**
 * Creates a FetcherError with proper structure
 */
function createFetcherError(
  message: string,
  status: number,
  code: string,
  info?: FetcherErrorInfo | string | null
): FetcherError {
  const error = new Error(message) as FetcherError;
  error.status = status;
  error.code = code;
  error.info = info ?? null;
  return error;
}

/**
 * Checks if content appears to be HTML
 */
function isHtmlContent(content: string, contentType?: string | null): boolean {
  const trimmed = content.trim();
  return (
    trimmed.startsWith("<") ||
    trimmed.toLowerCase().startsWith("<!doctype") ||
    (contentType?.includes("html") ?? false)
  );
}

/**
 * Gets a user-friendly error message based on HTML content and status
 */
function getErrorMessageFromHtml(htmlContent: string, status: number): string {
  const lowerContent = htmlContent.toLowerCase();

  if (lowerContent.includes("timeout") || lowerContent.includes("timed out")) {
    return "The request timed out. Please try again.";
  }
  if (status === 502 || lowerContent.includes("bad gateway")) {
    return "Service temporarily unavailable. Please try again.";
  }
  if (status === 503 || lowerContent.includes("service unavailable")) {
    return "Service temporarily unavailable. Please try again.";
  }
  if (status === 504 || lowerContent.includes("gateway timeout")) {
    return "The service took too long to respond. Please try again.";
  }

  return "Service unavailable. Please try again later.";
}

/**
 * Safely reads response text, returning empty string on error
 */
async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * Handles error responses (non-OK status codes)
 */
async function handleErrorResponse(
  response: Response,
  contentType: string | null
): Promise<never> {
  const errorText = await readResponseText(response);

  if (isHtmlContent(errorText, contentType)) {
    const message = getErrorMessageFromHtml(errorText, response.status);
    throw createFetcherError(
      message,
      response.status,
      FetcherErrorCode.INVALID_RESPONSE_FORMAT,
      { contentType, responsePreview: errorText.substring(0, 200) } as FetcherErrorInfo
    );
  }

  try {
    const errorData = JSON.parse(errorText) as { error?: string; message?: string };
    const errorMessage =
      errorData.error || errorData.message || response.statusText || "Request failed";
    throw createFetcherError(
      errorMessage,
      response.status,
      response.status >= 500
        ? FetcherErrorCode.SERVER_ERROR
        : FetcherErrorCode.CLIENT_ERROR,
      errorData as FetcherErrorInfo
    );
  } catch (parseError) {
    if (parseError instanceof Error && "code" in parseError) {
      throw parseError;
    }
    throw createFetcherError(
      errorText || response.statusText || "Request failed",
      response.status,
      FetcherErrorCode.SERVER_ERROR
    );
  }
}

/**
 * Handles responses with non-JSON content-type
 */
async function handleNonJsonResponse<T>(
  response: Response,
  contentType: string | null
): Promise<T> {
  const responseText = await readResponseText(response);

  if (isHtmlContent(responseText, contentType)) {
    const message = getErrorMessageFromHtml(responseText, response.status);
    throw createFetcherError(
      message,
      response.status || 502,
      FetcherErrorCode.INVALID_RESPONSE_FORMAT,
      { contentType, responsePreview: responseText.substring(0, 200) } as FetcherErrorInfo
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw createFetcherError(
      "Server returned an unexpected response format",
      response.status || 500,
      FetcherErrorCode.INVALID_RESPONSE_FORMAT,
      { contentType, responsePreview: responseText.substring(0, 200) } as FetcherErrorInfo
    );
  }
}

/**
 * Parses JSON from response, handling parse errors
 */
async function parseJsonSafely<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch (parseError) {
    throw createFetcherError(
      "Failed to parse server response",
      response.status || 500,
      FetcherErrorCode.JSON_PARSE_ERROR,
      {
        parseError:
          parseError instanceof Error ? parseError.message : String(parseError),
      } as FetcherErrorInfo
    );
  }
}

/**
 * Safely parses a response as JSON, handling non-JSON responses gracefully.
 * This is intended for client-side use in custom SWR fetchers.
 *
 * @param response - The fetch Response object
 * @returns The parsed JSON data
 * @throws FetcherError with user-friendly message if response is not JSON
 */
export async function safeJsonParse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    await handleErrorResponse(response, contentType);
  }

  if (response.status === 204) {
    return null as T;
  }

  if (!contentType?.includes("application/json")) {
    return handleNonJsonResponse<T>(response, contentType);
  }

  return parseJsonSafely<T>(response);
}

/**
 * A safe fetcher wrapper that handles non-JSON responses gracefully.
 * Use this in SWR custom fetchers instead of raw fetch + response.json().
 *
 * @param url - The URL to fetch
 * @param init - Optional fetch init options
 * @returns The parsed JSON data
 */
export async function safeFetch<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, init);
  return safeJsonParse<T>(response);
}
