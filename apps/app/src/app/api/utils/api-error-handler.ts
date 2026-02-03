import { NextResponse } from "next/server";
import {
  FetcherError,
  FetcherErrorCode,
} from "@/features/common/providers/fetcher.types";
import { logger } from "@/lib/logger";

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  error: string;
  status: number;
  code?: string;
}

/**
 * Type guard to check if an error is a FetcherError
 */
export function isFetcherError(error: unknown): error is FetcherError {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as FetcherError).status === "number"
  );
}

/**
 * Maps error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  [FetcherErrorCode.INVALID_RESPONSE_FORMAT]: "Service temporarily unavailable. Please try again.",
  [FetcherErrorCode.JSON_PARSE_ERROR]: "An error occurred processing the server response. Please try again.",
  [FetcherErrorCode.NETWORK_ERROR]: "Unable to connect to the service. Please try again.",
  [FetcherErrorCode.SERVER_ERROR]: "A server error occurred. Please try again.",
  [FetcherErrorCode.CLIENT_ERROR]: "Invalid request. Please check your input.",
  [FetcherErrorCode.ACTION_ERROR]: "Action failed. Please try again.",
};

/**
 * Returns a user-friendly error message based on the error type
 * @param error - The error to get a message for
 * @param fallbackMessage - Optional fallback message if no specific message is found
 */
export function getErrorMessage(error: unknown, fallbackMessage = "An error occurred. Please try again."): string {
  if (isFetcherError(error)) {
    // For known error codes, use the mapped message or the error's own message
    if (error.code && ERROR_MESSAGES[error.code]) {
      // Use the error's message if it's more specific (e.g., "The request timed out")
      // Otherwise use the mapped message
      return error.message || ERROR_MESSAGES[error.code];
    }
    
    // For FetcherErrors without a code, use the message if it doesn't expose technical details
    if (error.message && !isTechnicalErrorMessage(error.message)) {
      return error.message;
    }
  }
  
  if (error instanceof Error) {
    // Check if the error message contains technical details that shouldn't be shown
    if (!isTechnicalErrorMessage(error.message)) {
      return error.message;
    }
  }
  
  return fallbackMessage;
}

/**
 * Checks if an error message contains technical details that shouldn't be exposed to users
 */
function isTechnicalErrorMessage(message: string): boolean {
  const technicalPatterns = [
    /unexpected token/i,
    /is not valid json/i,
    /syntaxerror/i,
    /econnrefused/i,
    /etimedout/i,
    /enotfound/i,
    /<html/i,
    /<!doctype/i,
    /stack trace/i,
    /at \w+\s*\(/i, // Stack trace patterns like "at Function ("
  ];
  
  return technicalPatterns.some(pattern => pattern.test(message));
}

/**
 * Gets the HTTP status code from an error
 */
export function getErrorStatus(error: unknown): number {
  if (isFetcherError(error)) {
    return error.status;
  }
  return 500;
}

/**
 * Gets the error code from an error, if available
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isFetcherError(error)) {
    return error.code;
  }
  return undefined;
}

/**
 * Creates a standardized error response for API routes
 * @param error - The error to handle
 * @param context - Optional context for logging (e.g., "calculating ETA", "fetching tasks")
 * @param fallbackMessage - Optional fallback message
 */
export function handleApiError(
  error: unknown,
  context?: string,
  fallbackMessage?: string
): NextResponse<ApiErrorResponse> {
  // Log the error with context
  const errorObj = error instanceof Error ? error : new Error(String(error));
  if (context) {
    logger.error({ err: errorObj, context }, `Error ${context}`);
  } else {
    logger.error({ err: errorObj }, "API Error");
  }

  const status = getErrorStatus(error);
  const message = getErrorMessage(error, fallbackMessage);
  const code = getErrorCode(error);

  // Handle unauthorized errors
  if (status === 401) {
    return NextResponse.json(
      { error: "Unauthorized", status: 401 },
      { status: 401 }
    );
  }

  const response: ApiErrorResponse = {
    error: message,
    status,
  };

  // Include error code in response for debugging (optional)
  if (code) {
    response.code = code;
  }

  return NextResponse.json(response, { status });
}

/**
 * Creates an unauthorized response
 */
export function unauthorizedResponse(): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: "Unauthorized", status: 401 },
    { status: 401 }
  );
}

/**
 * Creates a bad request response
 */
export function badRequestResponse(message: string): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    { error: message, status: 400 },
    { status: 400 }
  );
}
