import "server-only";
import { auth } from "@/auth";
import { deleteNode } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get("nodeId");

    if (!nodeId) {
      return NextResponse.json(
        { error: "Missing required field: nodeId" },
        { status: 400 }
      );
    }

    const result = await deleteNode(session, nodeId);

    if (!result.ok) {
      return NextResponse.json(
        { error: `Delete failed: ${result.reason}` },
        { status: result.status }
      );
    }

    return NextResponse.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: "Delete failed" },
      { status: 500 }
    );
  }
}
