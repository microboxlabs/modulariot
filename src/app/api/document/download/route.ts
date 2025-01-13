import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId");
  //const documentName = url.searchParams.get("documentName");
  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  try {
    const alfrescoUrl = `${process.env.ECM_API_URL}/alfresco/s/api/node/content/${documentId}?a=true&alf_ticket=${session.user.ticket}`;
    let userAgent: Record<string, string> = {};
    if (process.env.USER_AGENT) {
      userAgent["User-Agent"] = process.env.USER_AGENT;
    }

    const response = await fetch(alfrescoUrl, {
      headers: {
        ...userAgent,
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Alfresco responded with status: ${response.status}`);
    }

    // Extract filename from Content-Disposition or use default
    const contentType = response.headers.get("Content-Type");
    const contentDisposition = response.headers.get("Content-Disposition");

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": contentDisposition || "", //`attachment; filename="${filename}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 },
    );
  }
}
