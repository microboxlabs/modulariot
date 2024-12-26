import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const documentId = url.searchParams.get("documentId");
  const documentName = url.searchParams.get("documentName");
  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  try {
    const alfrescoUrl = `${process.env.ECM_API_URL}/alfresco/s/api/node/content/${documentId}?alf_ticket=${session.user.ticket}`;
    const response = await fetch(alfrescoUrl);

    console.log("response", response);

    if (!response.ok) {
      throw new Error(`Alfresco responded with status: ${response.status}`);
    }

    // Get the content type to determine file extension
    const contentType = response.headers.get("Content-Type");

    // Extract filename from Content-Disposition or use default
    let filename = (documentName || documentId.split("/").pop()) + ".pdf";

    const contentDisposition = response.headers.get("Content-Disposition");
    if (contentDisposition) {
      const matches = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/,
      );
      if (matches && matches[1]) {
        filename = matches[1].replace(/['"]/g, "");
      }
    }

    // Ensure filename has .pdf extension for PDF files
    if (contentType?.includes("application/pdf")) {
      filename = `${filename}.pdf`;
    }

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
