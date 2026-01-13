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
 */
const ERROR_PATTERNS: Array<{
  regex: RegExp;
  code: string;
  exceptionType: string;
}> = [
  {
    regex: /cl\.mintral\.errors\.RequiredDataMissingError: (.*)/,
    code: "REQUIRED_DATA_MISSING",
    exceptionType: "RequiredDataMissingError",
  },
  {
    regex: /com\.alerce\.errors\.AlerceLoginError: (.*)/,
    code: "ALERCE_LOGIN_ERROR",
    exceptionType: "AlerceLoginError",
  },
  {
    regex:
      /cl\.mintral\.features\.alerce\.notifications\.DuplicateLicensePlateError: (.*)/,
    code: "DUPLICATE_LICENSE_PLATE_ERROR",
    exceptionType: "DuplicateLicensePlateError",
  },
];

/**
 * Attempts to match error message against known error patterns
 */
function matchKnownErrorPattern(
  errorMessage: string
): AlfrescoErrorResponse | null {
  // Try to match generic exception with JSON details
  const genericMatch = errorMessage.match(/(\w+(?:\.\w+)*Error): ({.*})/);
  if (genericMatch) {
    const [, exceptionType, jsonDetails] = genericMatch;
    const details = JSON.parse(jsonDetails) as Record<string, unknown>;
    return {
      code: (details.code as string) || "UNKNOWN_ERROR",
      message: (details.message as string) || "An unknown error occurred",
      exceptionType,
      details,
    };
  }

  // Try known error patterns
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
    // Handle HTML content in error.info (timeout page, error page, etc.)
    if (error.info && isHtmlContent(error.info)) {
      return createServiceErrorResponse();
    }

    // Parse error.info if available
    if (error.info) {
      const parsedError = JSON.parse(error.info) as Record<string, unknown>;
      return {
        code: "ERROR",
        message: parsedError.message as string,
        exceptionType: "Error",
        details: {},
      };
    }

    // Handle HTML content in error.message
    if (error.message && isHtmlContent(error.message)) {
      return createServiceErrorResponse();
    }

    // Handle JSON parsing errors in error.message
    if (error.message && isJsonParsingError(error.message)) {
      return createServiceErrorResponse();
    }

    // Try to parse error.message as JSON and match known patterns
    if (error.message) {
      const parsedError = JSON.parse(error.message) as Record<string, unknown>;
      const errorMessage = parsedError.message as string;
      const matchedResponse = matchKnownErrorPattern(errorMessage);
      if (matchedResponse) {
        return matchedResponse;
      }
      throw new Error(error.message);
    }

    throw new Error(JSON.stringify(error));
  } catch {
    return createServiceErrorResponse("An error occurred. Please try again.");
  }
}
