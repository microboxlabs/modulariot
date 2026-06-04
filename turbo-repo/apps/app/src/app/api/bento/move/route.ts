import "server-only";
import { auth } from "@/auth";
import { getTaskById, moveNode } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { nodeId, targetTaskId } = await request.json();

    if (!nodeId || !targetTaskId) {
      return NextResponse.json(
        { error: "Missing required fields: nodeId and targetTaskId" },
        { status: 400 }
      );
    }

    const targetTask = await getTaskById(session, targetTaskId);
    const bpmPackage: string | undefined = targetTask?.bpm_package;

    if (!bpmPackage) {
      return NextResponse.json(
        { error: "Target task has no package folder" },
        { status: 422 }
      );
    }

    // bpm_package is "workspace://SpacesStore/{uuid}" — take the last segment
    const targetParentId = bpmPackage.split("/").pop();

    if (!targetParentId) {
      return NextResponse.json(
        { error: "Invalid target package reference" },
        { status: 422 }
      );
    }

    await moveNode(session, nodeId, targetParentId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logError(error as Error);
    return NextResponse.json(
      { error: "Move failed" },
      { status: 500 }
    );
  }
}
