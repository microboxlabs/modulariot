import { unclaimTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { requirePermission } from "@/features/auth/access/server-access";
import { ACCESS_RULES } from "@/features/auth/access/access-rules";
import { NextRequest, NextResponse } from "next/server";
import { logger, logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const access = await requirePermission(
      ACCESS_RULES.taskUnclaim,
      "/api/task/unclaim"
    );
    if (!access.authorized) return access.response;
    const { session } = access;

    const { taskId } = (await request.json()) as { taskId: string };

    if (!taskId) {
      return NextResponse.json(
        {
          success: false,
          error: "Task ID is required",
        },
        { status: 400 }
      );
    }

    logger.info(
      `Unclaiming task ${taskId} by admin user: ${session.user?.email}`
    );

    await unclaimTask(session, taskId);

    return NextResponse.json({
      success: true,
    });
  } catch (_error: unknown) {
    logError(_error as Error);
    return NextResponse.json(
      {
        success: false,
        error: _error instanceof Error ? _error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
