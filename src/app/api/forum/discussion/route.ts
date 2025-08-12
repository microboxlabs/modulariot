import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getForumDiscussion } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({ status: 401 });
  }

  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId") || undefined;
  const instanceId = url.searchParams.get("instanceId") || undefined;
  const serviceCode = url.searchParams.get("serviceCode") || undefined;

  try {
    const result = await getForumDiscussion(session.user.ticket, {
      taskId,
      instanceId,
      serviceCode,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    logError(e as Error, {
      route: "GET /app/api/forum/discussion",
      taskId,
      instanceId,
      serviceCode,
    });
    if (e?.status === 401) {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch forum discussion" },
      { status: 500 },
    );
  }
}
