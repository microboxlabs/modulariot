import { auth } from "@/auth";
import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { AlfrescoErrorResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.next({
        status: 401,
      });
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const json = await request.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const taskId = json.taskId as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const transitionId: string | undefined = json.transitionId;
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
    const regex = /(\w+(?:\.\w+)*Error): ({.*})/;
    const match = errorMessage.match(regex);

    if (match) {
      const [, exceptionType, jsonDetails] = match;
      const details = JSON.parse(jsonDetails) as Record<string, unknown>;

      return {
        code: (details.code as string) || "UNKNOWN_ERROR",
        message: (details.message as string) || "An unknown error occurred",
        exceptionType,
        details,
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
