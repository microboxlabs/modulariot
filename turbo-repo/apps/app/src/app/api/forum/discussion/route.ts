import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getForumDiscussion } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { ForumDiscussionResponse } from "@/features/common/providers/alfresco-api/alfresco-api.types";
import { logError } from "@/lib/logger";
import { redirectWithLang } from "@/features/auth/services/navigation.service";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: 401 });
  }

  const url = new URL(req.url);
  const taskId = url.searchParams.get("taskId") || undefined;
  const instanceId = url.searchParams.get("instanceId") || undefined;
  const serviceCode = url.searchParams.get("serviceCode") || undefined;

  try {
    const result = await getForumDiscussion(session, {
      taskId,
      instanceId,
      serviceCode,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    // A missing forum is the normal empty state — no chat/topic has been created
    // for this workflow package yet. ECM signals it as 404 "Forum not found".
    // Surface it as an empty discussion so the UI renders an empty thread (and
    // lazily creates the first topic) instead of failing.
    if (e?.status === 404) {
      return NextResponse.json({ forum: "", topics: [] } satisfies ForumDiscussionResponse);
    }
    logError(e as Error, {
      route: "GET /app/api/forum/discussion",
      taskId,
      instanceId,
      serviceCode,
    });
    if (e?.status === 401) {
      redirectWithLang(`/sign-in`);
    }
    // Propagate the upstream status instead of masking everything as 500.
    return NextResponse.json(
      { error: "Failed to fetch forum discussion" },
      { status: e?.status ?? 500 }
    );
  }
}
