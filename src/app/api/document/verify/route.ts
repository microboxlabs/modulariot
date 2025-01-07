import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { checkDocumentExists } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

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
    const exists = await checkDocumentExists(session.user.ticket, documentId);
    return NextResponse.json({ exists });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to verify document" },
      { status: 500 },
    );
  }
}
