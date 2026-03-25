import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { createForumTopic } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logError } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ status: 401 });
  }

  const body = (await req.json()) as {
    bpmPackage: string;
    title: string;
    content?: string;
  };

  if (!body?.bpmPackage || !body?.title) {
    return NextResponse.json(
      { error: "bpmPackage and title are required" },
      { status: 400 }
    );
  }

  try {
    const result = await createForumTopic(session, {
      bpmPackage: body.bpmPackage,
      title: body.title,
      content: body.content ?? "",
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e: any) {
    logError(e);

    if (e?.status === 401) {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create forum topic" },
      { status: 500 }
    );
  }
}
