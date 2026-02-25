import { auth } from "@/auth";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
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
    // documentId arrives as the Alfresco node content path
    // Format: "{protocol}/{storeType}/{uuid}" — e.g. "workspace/SpacesStore/1c903be0-..."
    // This is the slash-separated form of the nodeRef (workspace://SpacesStore/{uuid})
    // and maps directly to the legacy API path: /alfresco/s/api/node/content/{nodeContentPath}
    const nodeContentPath = documentId;

    const { url, headers } = prepareAlfrescoAuth(
      `${process.env.ECM_API_URL}/alfresco/s/api/node/content/${nodeContentPath}?a=true`,
      session
    );

    let userAgent: Record<string, string> = {};
    if (process.env.USER_AGENT) {
      userAgent["User-Agent"] = process.env.USER_AGENT;
    }

    const response = await fetch(url, {
      headers: {
        ...headers,
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
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}
