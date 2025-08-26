import { auth } from "@/auth";
import {
  endTask,
  updateTask,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { NextRequest, NextResponse } from "next/server";
import { EndTaskRequest, UpdateTaskRequest } from "./route.types";
import { logger, logError } from "@/lib/logger";

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

    let updateTaskPayload: UpdateTaskRequest = {
      prop_cm_owner: user!.email!,
    };

    if (comments) {
      updateTaskPayload.prop_bpm_comment = comments;
      updateTaskPayload.prop_mintral_commentPostContent = comments;
    }
    if (nativeGenerationEnabled) {
      updateTaskPayload.prop_mintral_shouldBuildManifest =
        nativeGenerationEnabled.toLowerCase() === "true" ? "true" : "false";
    }
    if (reason && reason.trim() !== "") {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (_error: any) {
    logError(_error as Error);
    if (_error instanceof Error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const error = parseErrorAsJson(_error);
      return NextResponse.json({ success: false, error }, { status: 500 });
    }
    return NextResponse.json({
      success: false,
      status: 500,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      error: (_error?.message as string) ?? "Unknown error",
    });
  }
}

function parseErrorAsJson(error: Error): AlfrescoErrorResponse {
  try {
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

    throw new Error("Unable to parse error details");
  } catch (parseError) {
    return {
      code: "PARSE_ERROR",
      message: "Failed to parse error message",
      exceptionType: "UnknownError",
      details: {},
    };
  }
}
