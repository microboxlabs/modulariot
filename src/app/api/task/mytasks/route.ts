import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getFinishedWorkflows,
  getUserTasks,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { toShippingKanban } from "@/features/shipping/services/data.service";
import { KanbanBoard } from "@/features/shipping/types/common.types";
import {
  FinishedWorkflowsResponse,
  FastTasksResponse,
} from "@/features/common/providers/alfresco-api/alfresco-api.types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);

  const columns = url.searchParams.getAll("columns");
  const page = url.searchParams.get("page");
  const limit = url.searchParams.get("limit");
  const show_finished = url.searchParams.get("showFinished") === "true";

  let data: Record<string, KanbanBoard> = {};
  let total = 0;

  const options = {
    from: page ? parseInt(page) * parseInt(limit as string) : 0,
    size: limit ? parseInt(limit) : 10,
    filter: undefined,
  };

  try {
    let taskResponses: FastTasksResponse | FinishedWorkflowsResponse = {
      tasks: [],
      total: 0,
    };

    if (show_finished) {
      taskResponses = await Promise.all([
        getFinishedWorkflows(session.user.ticket, {
          from: page ? parseInt(page) * parseInt(limit as string) : 0,
          size: limit ? parseInt(limit) : 10,
          definitionKey: "shippingCoordinatorProcess",
        }).then((res) => ({
          tasks: res.workflows,
          total: res.total,
        })),
      ]);
    } else {
      taskResponses = await Promise.all([
        ...columns.map((column) => {
          return getUserTasks(session.user.ticket, column, options);
        }),
      ]);
    }

    taskResponses.forEach((tasks) => {
      toShippingKanban(tasks, data);
      total += tasks.total;
    });
    return NextResponse.json({
      total,
      data,
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
