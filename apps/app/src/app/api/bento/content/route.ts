import { auth } from "@/auth";
import { logError } from "@/lib/logger";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reqUrl = new URL(req.url);
  const nodeId = reqUrl.searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({ error: "Missing nodeId" }, { status: 400 });
  }

  try {
    let userAgent: Record<string, string> = {};
    if (process.env.USER_AGENT) {
      userAgent["User-Agent"] = process.env.USER_AGENT;
    }

    const { url, headers } = prepareAlfrescoAuth(
      `${process.env.ECM_API_URL}/alfresco/api/-default-/public/alfresco/versions/1/nodes/${nodeId}/content`,
      session
    );

    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...headers,
        ...userAgent,
        Accept: "*/*",
      },
    });

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Content not found" },
        { status: 404 }
      );
    }

    if (!response.ok) {
      throw new Error(`Alfresco response status: ${response.status}`);
    }

    const contentType = response.headers.get("Content-Type");

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    console.error("contentFetch error:", error);
    logError(error instanceof Error ? error : new Error(String(error)), {
      context: "contentFetch",
    });
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
