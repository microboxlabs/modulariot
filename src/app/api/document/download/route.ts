import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getContentNode } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  try {
    const content = await getContentNode(session.user.ticket, documentId);
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 },
    );
  }
}
