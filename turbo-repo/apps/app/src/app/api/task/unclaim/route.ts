import { auth } from "@/auth";
import {
  unclaimTask,
  getGroupsForPerson,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logger, logError } from "@/lib/logger";

const ADMIN_GROUPS = [
  "GROUP_ALFRESCO_ADMINISTRATORS",
  "GROUP_MINTRAL_SYSTEM_ADMIN",
];

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // Verify admin permissions
    const userGroups = await getGroupsForPerson(session);
    const hasAdminAccess = userGroups.some((group) =>
      ADMIN_GROUPS.includes(group)
    );

    if (!hasAdminAccess) {
      logger.warn(
        `Unauthorized unclaim attempt by user: ${session.user?.email}`
      );
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden: Admin access required",
        },
        { status: 403 }
      );
    }

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
