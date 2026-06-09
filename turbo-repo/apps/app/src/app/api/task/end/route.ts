import { auth } from "@/auth";
import {
  endTask,
  updateTask,
  getChildrenNodes,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  AlfrescoErrorResponse,
  InfoError,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { listContentTopics } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { EndTaskRequest, UpdateTaskRequest } from "./route.types";
import { logger, logError } from "@/lib/logger";
import {
  getErrorMessage,
  getErrorStatus,
  isFetcherError,
} from "@/app/api/utils/api-error-handler";
import type { Session } from "next-auth";

// All transition IDs that advance the workflow forward.
// Backward/previous transitions (secondary options) are not in this set,
// so they remain allowed even when documents are rejected.
const FORWARD_TRANSITION_IDS = new Set([
  "Presentar Conductor",
  "Preparar Servicio",
  "Torre de Control: Iniciar Viaje",
  "Torre de Control: Iniciar Viaje sin firma",
  "Monitorear viaje en curso",
  "Confirmar Arribo",
  "Confirmar Cierre Monitoreo / Entrega",
  "Viaje Finalizado",
  "Recibir Entrega",
  "Notificar Entrega (5.11)",
  "Separar Documentos",
  "Planificar Servicio",
  "Asignar Conductor/Transporte",
]);

type ReviewViolation = { code: string; message: string };

async function checkDocumentReview(
  session: Session,
  bpmPackage: string,
  transitionId: string | undefined
): Promise<ReviewViolation | null> {
  const packageNodeId = bpmPackage.split("/").pop();
  if (!packageNodeId) return null;

  try {
    const children = await getChildrenNodes(session, packageNodeId, {
      include: ["properties", "aspectNames"],
      maxItems: 200,
    });

    const entries = children?.list?.entries ?? [];
    const reviewable = entries.filter((e) =>
      e.entry.aspectNames?.includes("mintral:reviewableAspect")
    );

    if (reviewable.length === 0) return null;

    const hasPending = reviewable.some((e) => {
      const s = e.entry.properties?.["mintral:reviewStatus"];
      return !s || s === "PENDING";
    });

    if (hasPending) {
      return {
        code: "UNREVIEWED_DOCUMENTS",
        message: "Cannot advance: some documents are still pending review.",
      };
    }

    const rejectedEntries = reviewable.filter(
      (e) => e.entry.properties?.["mintral:reviewStatus"] === "REJECTED"
    );

    if (rejectedEntries.length > 0 && transitionId && FORWARD_TRANSITION_IDS.has(transitionId)) {
      return {
        code: "REJECTED_DOCUMENTS",
        message: "Cannot advance: some documents have been rejected.",
      };
    }

    // Business rule: every rejected document must have at least one observation
    // (a forum topic that is not a state-change entry).
    if (rejectedEntries.length > 0) {
      const STATE_CHANGE_TITLES = new Set(["APPROVED", "REJECTED", "PENDING"]);

      const topicChecks = await Promise.allSettled(
        rejectedEntries.map((e) => {
          const nodeRef = `workspace://SpacesStore/${e.entry.id}`;
          return listContentTopics(session, nodeRef);
        })
      );

      const hasDocWithoutObservation = topicChecks.some((result, i) => {
        if (result.status === "rejected") {
          // Fail open for this document — log and skip the check.
          logError(result.reason as Error, {
            context: "checkDocumentReview:listContentTopics",
            nodeId: rejectedEntries[i]?.entry.id,
          });
          return false;
        }
        const observationTopics = (result.value.topics ?? []).filter(
          (t) => !STATE_CHANGE_TITLES.has(t.title)
        );
        return observationTopics.length === 0;
      });

      if (hasDocWithoutObservation) {
        return {
          code: "REJECTED_WITHOUT_OBSERVATIONS",
          message: "Cannot proceed: all rejected documents must have at least one observation.",
        };
      }
    }
  } catch (err) {
    // Fail open: if Alfresco is unreachable, log and allow the transition
    // rather than blocking users on a transient infra issue.
    logError(err as Error, { context: "checkDocumentReview" });
  }

  return null;
}

/**
 * Fields to skip during dynamic property mapping
 */
const SKIP_FIELDS = new Set([
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

/**
 * Maps a form field key to its Alfresco property key
 */
function mapFieldToPropertyKey(key: string): string | null {
  if (SKIP_FIELDS.has(key)) {
    return null;
  }
  if (key.startsWith("prop_")) {
    return key;
  }
  if (key.startsWith("mintral_") || !key.startsWith("_")) {
    return `prop_${key}`;
  }
  return null;
}

/**
 * Builds dynamic properties from form fields
 */
function buildDynamicProperties(
  json: EndTaskRequest
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(json)) {
    const propKey = mapFieldToPropertyKey(key);
    if (propKey) {
      properties[propKey] = value;
    }
  }

  return properties;
}

/**
 * Adds comment properties to payload
 */
function addCommentProperties(
  payload: UpdateTaskRequest,
  comments: string | undefined
): void {
  if (!comments) {
    return;
  }
  payload.prop_bpm_comment = comments;
  payload.prop_mintral_commentPostContent = comments;
}

/**
 * Adds native generation property to payload
 */
function addNativeGenerationProperty(
  payload: UpdateTaskRequest,
  nativeGenerationEnabled: string | undefined
): void {
  if (!nativeGenerationEnabled) {
    return;
  }
  payload.prop_mintral_shouldBuildManifest =
    nativeGenerationEnabled.toLowerCase() === "true" ? "true" : "false";
}

/**
 * Parses multi-reason array and adds to payload
 */
function addMultiReasonProperties(
  payload: UpdateTaskRequest,
  reasons: string[]
): boolean {
  try {
    if (reasons.length > 0) {
      payload.prop_mintral_commentReasons = reasons;
      payload.prop_mintral_commentPostTitle = `Multiple reasons: ${reasons.length} items`;
      return true;
    }
  } catch {
    logger.info(`Failed to parse reasons array: ${reasons}`);
  }
  return false;
}

/**
 * Adds reason properties to payload (single or multi)
 */
function addReasonProperties(
  payload: UpdateTaskRequest,
  reason: string | undefined,
  reasons: string | string[] | undefined,
  isMultiReason: boolean
): void {
  if (isMultiReason && reasons) {
    const success = addMultiReasonProperties(payload, Array.isArray(reasons) ? reasons : [reasons]);
    if (success) {
      return;
    }
    // Fallback to single reason
    if (typeof reasons === "string" && reasons.trim() !== "") {
      payload.prop_mintral_commentPostTitle = reasons;
    }
    return;
  }

  if (reason?.trim()) {
    payload.prop_mintral_commentPostTitle = reason;
  }
}

/**
 * Builds the complete update task payload
 */
function buildUpdateTaskPayload(
  json: EndTaskRequest,
  ownerEmail: string
): UpdateTaskRequest {
  const payload: UpdateTaskRequest = {
    prop_cm_owner: ownerEmail,
    ...buildDynamicProperties(json),
  };

  addCommentProperties(payload, json.comments);
  addNativeGenerationProperty(payload, json.nativeGenerationEnabled);
  addReasonProperties(
    payload,
    json.reason,
    json.reasons,
    json.isMultiReason === "true"
  );

  return payload;
}

/**
 * Handles error responses for the POST endpoint
 */
function handlePostError(error: unknown): NextResponse {
  logError(error as Error, { context: "ending task" });

  if (isFetcherError(error)) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error, "Failed to complete task. Please try again.");
    return NextResponse.json(
      { success: false, error: { code: error.code ?? "UNKNOWN_ERROR", message } },
      { status }
    );
  }

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ status: 401 });
    }

    const json = (await request.json()) as EndTaskRequest;

    // Planner task-driven ASSIGN move: when `processVariables` is present,
    // the caller is the calendar planner threading the assign tuple onto
    // the `assignDriver → presentDriver` transition. There are no form
    // fields to write — the resource tuple is the entire payload — so
    // skip the kanban `updateTask` step and POST endTask with the variables
    // body (ecm-coordinator#262). The kanban form-driven path is unchanged.
    if (json.processVariables) {
      const response = await endTask(
        session,
        json.taskId,
        json.transitionId,
        json.processVariables
      );
      return NextResponse.json({ success: true, status: 200, ...response });
    }

    if (json.bpm_package) {
      const violation = await checkDocumentReview(session, json.bpm_package, json.transitionId);
      if (violation) {
        return NextResponse.json({ success: false, error: violation }, { status: 422 });
      }
    }

    const updateTaskPayload = buildUpdateTaskPayload(json, session.user.email);

    logger.info(`updateTaskPayload=${JSON.stringify(updateTaskPayload)}`);
    await updateTask(session, "activiti$" + json.taskId, updateTaskPayload);

    const response = await endTask(session, json.taskId, json.transitionId);
    return NextResponse.json({ success: true, status: 200, ...response });
  } catch (error: unknown) {
    return handlePostError(error);
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
  for (const char of str) {
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
    const match = pattern.regex.exec(errorMessage);
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

/**
 * Truncates a string to the maximum allowed length for error messages
 */
function truncateErrorString(str: string | undefined): string | undefined {
  if (!str) {
    return str;
  }
  return str.length > MAX_ERROR_MESSAGE_LENGTH
    ? str.substring(0, MAX_ERROR_MESSAGE_LENGTH)
    : str;
}

/**
 * Attempts to parse error.info and return an appropriate response
 */
function tryParseErrorInfo(errorInfo: string): AlfrescoErrorResponse {
  if (isHtmlContent(errorInfo)) {
    return createServiceErrorResponse();
  }

  const parsedError = JSON.parse(errorInfo) as Record<string, unknown>;
  return {
    code: "ERROR",
    message: parsedError.message as string,
    exceptionType: "Error",
    details: {},
  };
}

/**
 * Attempts to parse error.message and return an appropriate response
 */
function tryParseErrorMessage(errorMessage: string): AlfrescoErrorResponse | null {
  if (isHtmlContent(errorMessage) || isJsonParsingError(errorMessage)) {
    return createServiceErrorResponse();
  }

  const parsedError = JSON.parse(errorMessage) as Record<string, unknown>;
  const message = parsedError.message as string;
  return matchKnownErrorPattern(message);
}

function parseErrorAsJson(error: InfoError): AlfrescoErrorResponse {
  try {
    const errorInfoStr =
      typeof error.info === "string" ? truncateErrorString(error.info) : undefined;
    const errorMessageStr = truncateErrorString(error.message);

    if (errorInfoStr) {
      return tryParseErrorInfo(errorInfoStr);
    }

    if (errorMessageStr) {
      const result = tryParseErrorMessage(errorMessageStr);
      if (result) {
        return result;
      }
    }

    throw new Error(JSON.stringify(error));
  } catch {
    return createServiceErrorResponse("An error occurred. Please try again.");
  }
}
