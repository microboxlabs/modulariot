import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getTaskById } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { TaskResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { KanbanBoard } from "@/features/shipping/types/common.types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);

  const taskId = url.searchParams.get("taskId");

  let data: Record<string, KanbanBoard> = {};
  let total = 0;

  try {
    let taskResponse: TaskResponse;

    if (!taskId) {
      return NextResponse.json({
        error: "Task ID is required",
        status: 400,
      });
    }

    taskResponse = await getTaskById(session, taskId);

    return NextResponse.json({
      taskResponse,
    });
  } catch (e: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (e?.status === 401) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          status: 401,
        },
        {
          status: 401,
        },
      );
    }
    return NextResponse.json({
      total,
      data,
    });
  }
}
