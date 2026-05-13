import "server-only";
import { auth } from "@/auth";
import { updateNodeName } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nodeId, name } = await request.json();

    if (!nodeId || !name?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields: nodeId and name" },
        { status: 400 }
      );
    }

    const success = await updateNodeName(session, nodeId, name.trim());

    if (!success) {
      return NextResponse.json(
        { error: "Rename failed - no response from server" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "File renamed successfully" });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: (error as Error).message || "Rename failed" },
      { status: 500 }
    );
  }
}
