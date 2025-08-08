import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getFinishedWorkflowByInstanceId,
  getTaskById,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  HistoricalWorkflow,
  TaskResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";
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
  const finished = url.searchParams.get("finished");

  let data: Record<string, KanbanBoard> = {};
  let total = 0;

  try {
    let taskResponse: TaskResponse | HistoricalWorkflow;

    if (!taskId) {
      return NextResponse.json({
        error: "Task ID is required",
        status: 400,
      });
    }

    if (finished === "true") {
      taskResponse = await getFinishedWorkflowByInstanceId(
        session.user.ticket,
        taskId,
      );
    } else {
      taskResponse = await getTaskById(session.user.ticket, taskId);
    }

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
