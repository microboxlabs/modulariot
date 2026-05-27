import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getContentDiscussion,
  createContentTopic,
  replyForumPost,
  deleteForumPost,
  deleteForumTopic,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logError } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const contentNodeRef = url.searchParams.get("contentNodeRef");

  if (!contentNodeRef) {
    return NextResponse.json(
      { error: "contentNodeRef is required" },
      { status: 400 }
    );
  }

  try {
    const result = await getContentDiscussion(session, contentNodeRef);
    return NextResponse.json(result);
  } catch (e: unknown) {
    logError(e as Error, {
      route: "GET /app/api/forum/content",
      contentNodeRef,
    });
    if ((e as any)?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch content discussion" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    action: "topic/create" | "post/reply" | "post/delete" | "topic/delete";
    contentNodeRef?: string;
    title?: string;
    content?: string;
    topic?: string;
    parentPost?: string;
    post?: string;
    author?: string;
  };

  if (!body?.action) {
    return NextResponse.json(
      { error: "action is required" },
      { status: 400 }
    );
  }

  try {
    switch (body.action) {
      case "topic/create": {
        if (!body.contentNodeRef || !body.title) {
          return NextResponse.json(
            { error: "contentNodeRef and title are required" },
            { status: 400 }
          );
        }
        const result = await createContentTopic(session, {
          contentNodeRef: body.contentNodeRef,
          title: body.title,
          content: body.content,
        });
        return NextResponse.json(result, { status: 201 });
      }
      case "post/reply": {
        if (!body.topic || !body.parentPost || !body.content) {
          return NextResponse.json(
            { error: "topic, parentPost, and content are required" },
            { status: 400 }
          );
        }
        const result = await replyForumPost(session, {
          topic: body.topic,
          parentPost: body.parentPost,
          title: body.title,
          content: body.content,
          author: body.author ?? "",
        });
        return NextResponse.json(result, { status: 201 });
      }
      case "post/delete": {
        if (!body.topic || !body.post) {
          return NextResponse.json(
            { error: "topic and post are required" },
            { status: 400 }
          );
        }
        const result = await deleteForumPost(session, {
          topic: body.topic,
          post: body.post,
        });
        return NextResponse.json(result);
      }
      case "topic/delete": {
        if (!body.topic) {
          return NextResponse.json(
            { error: "topic is required" },
            { status: 400 }
          );
        }
        const result = await deleteForumTopic(session, {
          bpmPackage: "_",
          topic: body.topic,
        });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }
  } catch (e: unknown) {
    const err = e as any;
    console.error("[forum/content] Error:", {
      action: body.action,
      contentNodeRef: body.contentNodeRef,
      status: err?.status,
      message: err?.message,
      body: err?.body ?? err?.data,
      raw: String(e),
    });
    logError(e as Error, {
      route: "POST /app/api/forum/content",
      action: body.action,
    });
    if ((e as any)?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: `Failed to execute ${body.action}` },
      { status: 500 }
    );
  }
}
