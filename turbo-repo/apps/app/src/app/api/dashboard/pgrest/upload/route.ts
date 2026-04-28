import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parseDataSourceParam, resolvePgrestCredentials } from "../shared";
import { buildAuthHeader } from "@/app/api/data-sources/resolve-credentials";
import { logger } from "@/lib/logger";

const PGREST_PATH_REGEX = /^[a-zA-Z_][\w/]*$/;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const functionName = url.searchParams.get("functionName");

  if (!functionName || !PGREST_PATH_REGEX.test(functionName)) {
    return NextResponse.json({ error: "Invalid or missing functionName" }, { status: 400 });
  }

  try {
    const creds = await resolvePgrestCredentials(session, parseDataSourceParam(request));
    if (creds instanceof NextResponse) return creds;

    const uploadUrl = `${creds.baseUrl}/${functionName}`;

    const formData = await request.formData();

    const upstreamForm = new FormData();
    for (const [key, value] of formData.entries()) {
      upstreamForm.append(key, value);
    }

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(creds.token, creds.authMethod),
      },
      body: upstreamForm,
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const body = await response.json();
        return NextResponse.json(body, { status: response.status });
      }
      const text = await response.text();
      logger.warn({ status: response.status, uploadUrl, body: text }, "Upload upstream error");
      return NextResponse.json(
        { error: response.statusText || "Upload failed" },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "File upload proxy error");
    return NextResponse.json(
      { error: "Failed to upload file. Please try again." },
      { status: 500 }
    );
  }
}
