import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const nodeId = url.searchParams.get("nodeId");

  if (!nodeId) {
    return NextResponse.json({ error: "Missing nodeId" }, { status: 400 });
  }

  try {
    const nodeRef = `workspace://SpacesStore/${nodeId}`;
    const path = nodeRef.replace(/:\//, "");

    let userAgent: Record<string, string> = {};
    if (process.env.USER_AGENT) {
      userAgent["User-Agent"] = process.env.USER_AGENT;
    }

    const response = await fetch(
      `${process.env.ECM_API_URL}/alfresco/s/api/node/${path}/content/thumbnails/doclib?alf_ticket=${session.user.ticket}`,
      {
        headers: {
          ...userAgent,
          Accept: "image/*",
        },
      },
    );

    // Handle 404 specifically - thumbnail doesn't exist
    if (response.status === 404) {
      return NextResponse.json(
        { error: "Thumbnail not found" },
        { status: 404 },
      );
    }

    // Handle other non-200 responses
    if (!response.ok) {
      throw new Error(`Alfresco response status: ${response.status}`);
    }

    // Extract filename from Content-Disposition or use default
    const contentType = response.headers.get("Content-Type");
    const contentDisposition = response.headers.get("Content-Disposition");

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType || "image/png",
        "Content-Disposition": contentDisposition || "",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    logger.error("Thumbnail fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch thumbnail" },
      { status: 500 },
    );
  }
}
