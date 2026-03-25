import { auth } from "@/auth";
import { prepareAlfrescoAuth } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id" },
      { status: 400 }
    );
  }

  try {
    const { url: alfrescoUrl, headers } = prepareAlfrescoAuth(
      `${process.env.ECM_API_URL}/alfresco/s/mintral/timelapse/stream?session_id=${encodeURIComponent(sessionId)}`,
      session
    );

    const response = await fetch(alfrescoUrl, {
      headers: {
        ...headers,
        Accept: "*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Alfresco responded with status: ${response.status}`);
    }

    const contentType = response.headers.get("Content-Type");
    const contentLength = response.headers.get("Content-Length");

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType || "video/mp4",
      "Cache-Control": "public, max-age=3600",
    };

    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    return new NextResponse(response.body, { headers: responseHeaders });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to stream timelapse" },
      { status: 500 }
    );
  }
}
