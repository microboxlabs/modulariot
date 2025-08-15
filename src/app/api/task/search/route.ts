import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getUserTasks } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { toShippingKanban } from "@/features/shipping/services/data.service";
import { KanbanBoard } from "@/features/shipping/types/common.types";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  const url = new URL(req.url);
  const filter = url.searchParams.get("filter");

  if (!filter) {
    return NextResponse.json(
      { error: "Filter parameter is required" },
      { status: 400 }
    );
  }

  const [key, value] = filter.split(":");

  let data: Record<string, KanbanBoard> = {};
  let total = 0;
  try {
    const tasks = await getUserTasks(session, "", {
      from: 0,
      size: 100,
      filter: {
        [key]: value,
      },
    });
    toShippingKanban(tasks, data);
    total = tasks.total;
    return NextResponse.json({
      total,
      data,
    });
  } catch (e: any) {
    if (e?.status === 401) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          status: 401,
        },
        {
          status: 401,
        }
      );
    }
    return NextResponse.json(
      {
        error: "An error occurred",
        status: 500,
      },
      {
        status: 500,
      }
    );
  }
}
