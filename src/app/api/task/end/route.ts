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

function parseErrorAsJson(error: InfoError): AlfrescoErrorResponse {
  try {
    // Check if error.info is HTML (timeout page, error page, etc.)
    if (error.info && isHtmlContent(error.info)) {
      return {
        code: "SERVICE_ERROR",
        message: "Service temporarily unavailable. Please try again.",
        exceptionType: "ServiceError",
        details: {},
      };
    }
    
    if (error.info) {
      const parsedError = JSON.parse(error.info) as Record<string, unknown>;
      const errorMessage = parsedError.message as string;
      return {
        code: "ERROR",
        message: errorMessage,
        exceptionType: "Error",
        details: {},
      };
    }
    
    // Check if error.message contains HTML
    if (error.message && isHtmlContent(error.message)) {
      return {
        code: "SERVICE_ERROR",
        message: "Service temporarily unavailable. Please try again.",
        exceptionType: "ServiceError",
        details: {},
      };
    }
    
    if (error.message) {
      // Check if message contains JSON parsing error patterns
      if (error.message.includes("Unexpected token") || 
          error.message.includes("is not valid JSON")) {
        return {
          code: "SERVICE_ERROR",
          message: "Service temporarily unavailable. Please try again.",
          exceptionType: "ServiceError",
          details: {},
        };
      }
      
      const parsedError = JSON.parse(error.message) as Record<string, unknown>;
      const errorMessage = parsedError.message as string;
      // Regex to extract exception type and JSON details
      let regex = /(\w+(?:\.\w+)*Error): ({.*})/;
      let match = errorMessage.match(regex);

      if (match) {
        let [, exceptionType, jsonDetails] = match;
        const details = JSON.parse(jsonDetails) as Record<string, unknown>;

        return {
          code: (details.code as string) || "UNKNOWN_ERROR",
          message: (details.message as string) || "An unknown error occurred",
          exceptionType,
          details,
        };
      }

      regex = /cl\.mintral\.errors\.RequiredDataMissingError: (.*)/;
      match = errorMessage.match(regex);

      if (match) {
        let [, message] = match;
        return {
          code: "REQUIRED_DATA_MISSING",
          message,
          exceptionType: "RequiredDataMissingError",
          details: {},
        };
      }

      regex = /com\.alerce\.errors\.AlerceLoginError: (.*)/;
      match = errorMessage.match(regex);

      if (match) {
        let [, message] = match;
        return {
          code: "ALERCE_LOGIN_ERROR",
          message,
          exceptionType: "AlerceLoginError",
          details: {},
        };
      }

      regex =
        /cl\.mintral\.features\.alerce\.notifications\.DuplicateLicensePlateError: (.*)/;
      match = errorMessage.match(regex);
      if (match) {
        let [, message] = match;
        return {
          code: "DUPLICATE_LICENSE_PLATE_ERROR",
          message,
          exceptionType: "DuplicateLicensePlateError",
          details: {},
        };
      }
      throw new Error(error.message);
    }

    throw new Error(JSON.stringify(error));
  } catch (parseError) {
    // If JSON parsing fails, return a generic user-friendly error
    return {
      code: "SERVICE_ERROR",
      message: "An error occurred. Please try again.",
      exceptionType: "UnknownError",
      details: {},
    };
  }
}
