import { NextRequest, NextResponse } from "next/server";
import {
  validateAndGetTask,
  ExtTaskError,
} from "@/features/ext-tasks/providers/ext-task.provider";
import { getTaskHandler } from "@/features/ext-tasks/handlers";
import { handleApiError } from "@/app/api/utils/api-error-handler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, taskType } = body as {
      token?: string;
      taskType?: string;
    };

    if (!token || !taskType) {
      return NextResponse.json(
        { error: "Missing required fields: token, taskType", status: 400 },
        { status: 400 },
      );
    }

    // Validate token — ExtTaskError uses specific status codes (400, 404, 410)
    const task = await validateAndGetTask(token, taskType);

    // Execute handler — upstream failures should return 502, not leak status codes
    const handler = getTaskHandler(taskType);
    try {
      const result = await handler(task.payload);
      return NextResponse.json(result);
    } catch (handlerError) {
      return handleApiError(
        handlerError,
        `executing ${taskType} handler`,
        "Task execution failed. Please try again later.",
      );
    }
  } catch (error) {
    if (error instanceof ExtTaskError) {
      return NextResponse.json(
        { error: error.message, status: error.statusCode },
        { status: error.statusCode },
      );
    }

    return handleApiError(error, "processing external task");
  }
}
