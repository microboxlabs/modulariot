"use client";

import { FetcherError, FetcherErrorCode } from "./fetcher.types";

/**
 * Creates a FetcherError with proper structure
 */
function createFetcherError(
  message: string,
  status: number,
  code: string,
  info?: unknown
): FetcherError {
  const error = new Error(message) as FetcherError;
  error.status = status;
  error.code = code;
  error.info = info;
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
 * Safely parses a response as JSON, handling non-JSON responses gracefully.
 * This is intended for client-side use in custom SWR fetchers.
 *
 * @param response - The fetch Response object
 * @returns The parsed JSON data
 * @throws FetcherError with user-friendly message if response is not JSON
 */
export async function safeJsonParse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");

  // If response is not ok, handle error appropriately
  if (!response.ok) {
    let errorText = "";
    try {
      errorText = await response.text();
    } catch {
      errorText = "";
    }

    // Check if it's HTML
    if (isHtmlContent(errorText, contentType)) {
      const message = getErrorMessageFromHtml(errorText, response.status);
      throw createFetcherError(
        message,
        response.status,
        FetcherErrorCode.INVALID_RESPONSE_FORMAT,
        { contentType, responsePreview: errorText.substring(0, 200) }
      );
    }

    // Try to parse error response as JSON
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
        errorData
      );
    } catch (parseError) {
      // If not JSON, return the text as error or generic message
      if (parseError instanceof Error && "code" in parseError) {
        throw parseError; // Re-throw FetcherError
      }
      throw createFetcherError(
        errorText || response.statusText || "Request failed",
        response.status,
        FetcherErrorCode.SERVER_ERROR
      );
    }
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  // Check if content-type is JSON
  if (!contentType?.includes("application/json")) {
    let responseText = "";
    try {
      responseText = await response.text();
    } catch {
      responseText = "";
    }

    // If it's HTML, throw a user-friendly error
    if (isHtmlContent(responseText, contentType)) {
      const message = getErrorMessageFromHtml(responseText, response.status);
      throw createFetcherError(
        message,
        response.status || 502,
        FetcherErrorCode.INVALID_RESPONSE_FORMAT,
        { contentType, responsePreview: responseText.substring(0, 200) }
      );
    }

    // Try to parse as JSON anyway (some servers don't set content-type correctly)
    try {
      return JSON.parse(responseText) as T;
    } catch {
      throw createFetcherError(
        "Server returned an unexpected response format",
        response.status || 500,
        FetcherErrorCode.INVALID_RESPONSE_FORMAT,
        { contentType, responsePreview: responseText.substring(0, 200) }
      );
    }
  }

  // Content-type is JSON, try to parse
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
      }
    );
  }
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
