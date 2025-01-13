import { auth } from "@/auth";
import {
  endTask,
  updateTask,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { NextRequest, NextResponse } from "next/server";
import { EndTaskRequest } from "./route.types";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.next({
        status: 401,
      });
    }
    const json = (await request.json()) as EndTaskRequest;
    const taskId = json.taskId;
    const transitionId = json.transitionId;
    const comments = json.comments;

    if (comments) {
      try {
        await updateTask(session.user.ticket, "activiti$" + taskId, {
          prop_bpm_comment: comments,
        });
      } catch (error) {
        // ignore for now, TODO: we need to do something if we got an error
      }
    }

    const response = await endTask(session.user.ticket, taskId, transitionId);
    return NextResponse.json({
      success: true,
      status: 200,
      ...response,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (_error: any) {
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

    regex = /com\.mintral\.errors\.RequiredDataMissingError: (.*)/;
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
