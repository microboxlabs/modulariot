import "server-only";
import { auth } from "@/auth";
import { updateNodeProperties } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nodeId, properties } = await request.json();

    if (!nodeId || !properties || typeof properties !== "object") {
      return NextResponse.json(
        { error: "Missing required fields: nodeId and properties" },
        { status: 400 }
      );
    }

    await updateNodeProperties(session, nodeId, properties);

    return NextResponse.json({ success: true, message: "Properties updated successfully" });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: (error as Error).message || "Update failed" },
      { status: 500 }
    );
  }
}
