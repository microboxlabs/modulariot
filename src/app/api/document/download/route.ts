import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

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
    const alfrescoUrl = `${process.env.ECM_API_URL}/alfresco/s/api/node/content/${documentId}?alf_ticket=${session.user.ticket}`;
    const response = await fetch(alfrescoUrl);

    if (!response.ok) {
      throw new Error(`Alfresco responded with status: ${response.status}`);
    }

    // Get the content type to determine file extension
    const contentType = response.headers.get("Content-Type");

    // Extract filename from Content-Disposition or use default
    let filename = documentId.split("/").pop() + ".pdf";

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("Document download error:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 },
    );
  }
}
