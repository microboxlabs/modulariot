import { auth } from "@/auth";
import {
  endTask,
  updateTask,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  AlfrescoErrorResponse,
  InfoError,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { NextRequest, NextResponse } from "next/server";
import { EndTaskRequest, UpdateTaskRequest } from "./route.types";
import { logger, logError } from "@/lib/logger";
import {
  getErrorMessage,
  getErrorStatus,
  isFetcherError,
} from "@/app/api/utils/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({
        status: 401,
      });
    }
    const { user } = session;
    const json = (await request.json()) as EndTaskRequest;
    const taskId = json.taskId;
    const transitionId = json.transitionId;
    const comments = json.comments;
    const nativeGenerationEnabled = json.nativeGenerationEnabled;
    const reason = json.reason;
    const reasons = json.reasons;
    const isMultiReason = json.isMultiReason === "true";

    let updateTaskPayload: UpdateTaskRequest = {
      prop_cm_owner: user!.email!,
    };

    // List of fields to skip during dynamic property mapping
    const skipFields = new Set([
      "taskId",
      "transitionId",
      "comments",
      "nativeGenerationEnabled",
      "reason",
      "reasonId",
      "reasons",
      "isMultiReason",
      "prop_cm_owner",
      "prop_bpm_comment",
      "prop_mintral_commentPostContent",
      "prop_mintral_shouldBuildManifest",
      "prop_mintral_commentReasons",
      "prop_mintral_commentPostTitle",
    ]);

    // Handle dynamic form properties
    // 1. Fields already prefixed with "prop_" are passed through directly
    // 2. Fields starting with "mintral_" are automatically prefixed with "prop_"
    Object.entries(json).forEach(([key, value]) => {
      if (skipFields.has(key)) {
        return;
      }

      // If already has prop_ prefix, use as-is
      if (key.startsWith("prop_")) {
        updateTaskPayload[key] = value;
      }
      // If starts with mintral_, add prop_ prefix
      else if (key.startsWith("mintral_")) {
        const propKey = `prop_${key}`;
        updateTaskPayload[propKey] = value;
      }
      // For any other custom fields, add prop_ prefix
      // This allows maximum flexibility for future dynamic forms
      else if (!key.startsWith("_")) { // Exclude internal Next.js fields
        const propKey = `prop_${key}`;
        updateTaskPayload[propKey] = value;
      }
    });

    if (comments) {
      updateTaskPayload.prop_bpm_comment = comments;
      updateTaskPayload.prop_mintral_commentPostContent = comments;
    }
    if (nativeGenerationEnabled) {
      updateTaskPayload.prop_mintral_shouldBuildManifest =
        nativeGenerationEnabled.toLowerCase() === "true" ? "true" : "false";
    }
    // Handle both single and multi-reason scenarios
    if (isMultiReason && reasons) {
      try {
        const reasonArray = JSON.parse(reasons) as string[];
        if (reasonArray.length > 0) {
          // Use custom metadata for multi-select rejection handling
          updateTaskPayload.prop_mintral_commentReasons = reasonArray;
          updateTaskPayload.prop_mintral_commentPostTitle = `Multiple reasons: ${reasonArray.length} items`;
        }
      } catch (error) {
        logger.info(`Failed to parse reasons array: ${reasons}`);
        // Fallback to treating as single reason if parsing fails
        if (reasons.trim() !== "") {
          updateTaskPayload.prop_mintral_commentPostTitle = reasons;
        }
      }
    } else if (reason && reason.trim() !== "") {
      // Single reason handling (existing logic)
      updateTaskPayload.prop_mintral_commentPostTitle = reason;
    }
    logger.info(`updateTaskPayload=${JSON.stringify(updateTaskPayload)}`);
    await updateTask(session, "activiti$" + taskId, updateTaskPayload);

    const response = await endTask(session, taskId, transitionId);
    return NextResponse.json({
      success: true,
      status: 200,
      ...response,
    });
  } catch (error: unknown) {
    logError(error as Error, { context: "ending task" });
    
    // Handle FetcherErrors (timeout, non-JSON responses, etc.) with user-friendly messages
    if (isFetcherError(error)) {
      const status = getErrorStatus(error);
      const message = getErrorMessage(error, "Failed to complete task. Please try again.");
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: error.code || "UNKNOWN_ERROR", 
            message 
          } 
        }, 
        { status }
      );
    }
    
    // For other errors, try to parse Alfresco-specific error format
    if (error instanceof Error) {
      const parsedError = parseErrorAsJson(error);
      return NextResponse.json({ success: false, error: parsedError }, { status: 500 });
    }
    
    return NextResponse.json({
      success: false,
      status: 500,
      error: { code: "UNKNOWN_ERROR", message: "An unexpected error occurred. Please try again." },
    });
  }
}

/**
 * Check if a string contains HTML content (indicating a non-JSON response)
 */
function isHtmlContent(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.startsWith("<") || trimmed.toLowerCase().includes("<!doctype");
}

/**
 * Check if a string contains JSON parsing error patterns
 */
function isJsonParsingError(message: string): boolean {
  return (
    message.includes("Unexpected token") || message.includes("is not valid JSON")
  );
}

/**
 * Creates a service error response for non-recoverable errors
 */
function createServiceErrorResponse(
  message = "Service temporarily unavailable. Please try again."
): AlfrescoErrorResponse {
  return {
    code: "SERVICE_ERROR",
    message,
    exceptionType: "ServiceError",
    details: {},
  };
}

/**
 * Known error patterns and their corresponding response mappings
 * Uses [^\n]* instead of .* to prevent catastrophic backtracking
 * and limit matching to a single line
 */
const ERROR_PATTERNS: Array<{
  regex: RegExp;
  code: string;
  exceptionType: string;
}> = [
  {
    regex: /cl\.mintral\.errors\.RequiredDataMissingError: ([^\n]{0,1000})/,
    code: "REQUIRED_DATA_MISSING",
    exceptionType: "RequiredDataMissingError",
  },
  {
    regex: /com\.alerce\.errors\.AlerceLoginError: ([^\n]{0,1000})/,
    code: "ALERCE_LOGIN_ERROR",
    exceptionType: "AlerceLoginError",
  },
  {
    regex:
      /cl\.mintral\.features\.alerce\.notifications\.DuplicateLicensePlateError: ([^\n]{0,1000})/,
    code: "DUPLICATE_LICENSE_PLATE_ERROR",
    exceptionType: "DuplicateLicensePlateError",
  },
];

/**
 * Maximum allowed length for error messages to prevent ReDoS attacks
 */
const MAX_ERROR_MESSAGE_LENGTH = 5000;

/**
 * Validates that a string looks like a Java-style exception type
 * e.g., "com.example.MyError" or "MyError"
 * Uses character-by-character validation to avoid regex backtracking
 */
function isValidExceptionType(str: string): boolean {
  if (str.length === 0 || str.length > 200) {
    return false;
  }

  // Must end with "Error"
  if (!str.endsWith("Error")) {
    return false;
  }

  // Check each character: must be word char or dot, no consecutive dots
  let lastWasDot = true; // Start true to ensure first char is not a dot
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const isWordChar =
      (char >= "a" && char <= "z") ||
      (char >= "A" && char <= "Z") ||
      (char >= "0" && char <= "9") ||
      char === "_";
    const isDot = char === ".";

    if (!isWordChar && !isDot) {
      return false;
    }
    if (isDot && lastWasDot) {
      return false; // No consecutive dots or starting with dot
    }
    lastWasDot = isDot;
  }

  // Must not end with a dot (already checked by endsWith("Error"))
  return true;
}

/**
 * Safely extracts JSON object from error message
 * Uses brace counting to prevent catastrophic backtracking
 */
function extractJsonFromError(errorMessage: string): string | null {
  const jsonStart = errorMessage.indexOf("{");
  if (jsonStart === -1) {
    return null;
  }

  // Find matching closing brace by counting braces (bounded approach)
  let braceCount = 0;
  let jsonEnd = -1;
  const maxLength = Math.min(errorMessage.length, jsonStart + 2000);

  for (let i = jsonStart; i < maxLength; i++) {
    if (errorMessage[i] === "{") {
      braceCount++;
    } else if (errorMessage[i] === "}") {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  if (jsonEnd === -1 || braceCount !== 0) {
    return null;
  }

  return errorMessage.substring(jsonStart, jsonEnd);
}

/**
 * Parses exception type and rest from an error message
 * Uses string operations instead of regex to avoid ReDoS
 * Expected format: "ExceptionType: rest of message"
 */
function parseExceptionMessage(
  errorMessage: string
): { exceptionType: string; rest: string } | null {
  const colonIndex = errorMessage.indexOf(":");
  if (colonIndex === -1 || colonIndex > 200) {
    return null;
  }

  const exceptionType = errorMessage.substring(0, colonIndex).trim();
  if (!isValidExceptionType(exceptionType)) {
    return null;
  }

  const rest = errorMessage.substring(colonIndex + 1).trim();
  if (rest.length === 0) {
    return null;
  }

  return { exceptionType, rest };
}

/**
 * Attempts to match error message against known error patterns
 */
function matchKnownErrorPattern(
  errorMessage: string
): AlfrescoErrorResponse | null {
  // Limit input size to prevent ReDoS attacks
  if (errorMessage.length > MAX_ERROR_MESSAGE_LENGTH) {
    return null;
  }

  // Try to parse generic exception with JSON details using string operations
  const parsed = parseExceptionMessage(errorMessage);
  if (parsed) {
    const jsonDetails = extractJsonFromError(parsed.rest);
    if (jsonDetails) {
      try {
        const details = JSON.parse(jsonDetails) as Record<string, unknown>;
        return {
          code: (details.code as string) || "UNKNOWN_ERROR",
          message: (details.message as string) || "An unknown error occurred",
          exceptionType: parsed.exceptionType,
          details,
        };
      } catch {
        // If JSON parsing fails, fall through to other patterns
      }
    }
  }

  // Try known error patterns (these are safe: anchored, specific, bounded)
  for (const pattern of ERROR_PATTERNS) {
    const match = errorMessage.match(pattern.regex);
    if (match) {
      return {
        code: pattern.code,
        message: match[1],
        exceptionType: pattern.exceptionType,
        details: {},
      };
    }
  }

  return null;
}

function parseErrorAsJson(error: InfoError): AlfrescoErrorResponse {
  try {
    // Limit input size to prevent ReDoS attacks
    const errorInfoStr =
      typeof error.info === "string" && error.info.length > MAX_ERROR_MESSAGE_LENGTH
        ? error.info.substring(0, MAX_ERROR_MESSAGE_LENGTH)
        : error.info;

    const errorMessageStr =
      error.message && error.message.length > MAX_ERROR_MESSAGE_LENGTH
        ? error.message.substring(0, MAX_ERROR_MESSAGE_LENGTH)
        : error.message;

    // Handle HTML content in error.info (timeout page, error page, etc.)
    if (errorInfoStr && typeof errorInfoStr === "string" && isHtmlContent(errorInfoStr)) {
      return createServiceErrorResponse();
    }

    // Parse error.info if available
    if (errorInfoStr && typeof errorInfoStr === "string") {
      const parsedError = JSON.parse(errorInfoStr) as Record<string, unknown>;
      return {
        code: "ERROR",
        message: parsedError.message as string,
        exceptionType: "Error",
        details: {},
      };
    }

    // Handle HTML content in error.message
    if (errorMessageStr && isHtmlContent(errorMessageStr)) {
      return createServiceErrorResponse();
    }

    // Handle JSON parsing errors in error.message
    if (errorMessageStr && isJsonParsingError(errorMessageStr)) {
      return createServiceErrorResponse();
    }

    // Try to parse error.message as JSON and match known patterns
    if (errorMessageStr) {
      const parsedError = JSON.parse(errorMessageStr) as Record<string, unknown>;
      const errorMessage = parsedError.message as string;
      const matchedResponse = matchKnownErrorPattern(errorMessage);
      if (matchedResponse) {
        return matchedResponse;
      }
      throw new Error(errorMessageStr);
    }

    throw new Error(JSON.stringify(error));
  } catch {
    return createServiceErrorResponse("An error occurred. Please try again.");
  }
}
