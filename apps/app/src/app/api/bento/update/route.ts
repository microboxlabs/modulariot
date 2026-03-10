import "server-only";
import { auth } from "@/auth";
import { updateNodeContent } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();

    const file = formData.get("filedata") as File;
    const nodeId = formData.get("nodeId") as string;

    if (!file || !nodeId) {
      return NextResponse.json(
        { error: "Missing required fields: filedata and nodeId" },
        { status: 400 }
      );
    }

    const alfrescoResponse = await updateNodeContent(session, {
      nodeId,
      filedata: file,
      name: file.name,
    });

    if (!alfrescoResponse) {
      return NextResponse.json(
        { error: "Update failed - no response from server" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File updated successfully",
      data: alfrescoResponse,
    });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      {
        error: (error as Error).message || "Update failed",
      },
      { status: 500 }
    );
  }
}
