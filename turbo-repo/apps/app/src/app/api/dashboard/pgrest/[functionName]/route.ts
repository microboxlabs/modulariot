import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parseDataSourceParam, resolvePgrestCredentials } from "../shared";

const FUNCTION_NAME_REGEX = /^[a-zA-Z_]\w*$/;

type RouteContext = { params: Promise<{ functionName: string }> };

function buildFetchOptions(req: NextRequest, rpcUrl: string, token: string) {
  const headers: Record<string, string> = {
    accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
  const fetchInit: RequestInit = { headers };
  let fullUrl = rpcUrl;

  if (req.method === "POST") {
    headers["Content-Type"] = "application/json";
    fetchInit.method = "POST";
  } else {
    fetchInit.method = "GET";
    const url = new URL(req.url);
    // Strip internal param before forwarding to upstream
    url.searchParams.delete("dataSourceId");
    const qs = url.searchParams.toString();
    if (qs) fullUrl = `${rpcUrl}?${qs}`;
  }

  return { fullUrl, fetchInit };
}

function isValidHttpError(status: number): boolean {
  return status >= 400 && status < 600;
}

async function validateResponse(response: Response, fullUrl: string) {
  if (!response.ok) {
    const status = isValidHttpError(response.status) ? response.status : 502;
    const contentType = response.headers.get("content-type");

    // Log upstream error details for debugging
    let upstreamBody = "";
    try {
      upstreamBody = await response.text();
    } catch { /* ignore */ }
    console.error(
      `[pgrest] Upstream ${response.status} from ${fullUrl}:`,
      upstreamBody || response.statusText
    );

    if (contentType?.includes("text/html")) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again." },
        { status }
      );
    }
    return NextResponse.json(
      { error: response.statusText || "Upstream error" },
      { status }
    );
  }

  const contentType = response.headers.get("content-type");
  if (!contentType?.includes("application/json")) {
    return NextResponse.json(
      { error: "Service returned an unexpected response. Please try again." },
      { status: 502 }
    );
  }

  return null;
}

async function handleRequest(req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { functionName } = await ctx.params;

  if (!FUNCTION_NAME_REGEX.test(functionName)) {
    return NextResponse.json(
      { error: "Invalid function name." },
      { status: 400 }
    );
  }

  try {
    const dataSourceId = parseDataSourceParam(req);
    const creds = await resolvePgrestCredentials(session, dataSourceId);
    if (creds instanceof NextResponse) {
      const body = await creds.clone().json().catch(() => ({}));
      console.error(
        `[pgrest] Credential resolution failed for dataSourceId=${dataSourceId}:`,
        body
      );
      return creds;
    }

    const rpcUrl = `${creds.baseUrl}/api/v1/pgrest/rpc/${functionName}`;
    const { fullUrl, fetchInit } = buildFetchOptions(req, rpcUrl, creds.token);

    if (req.method === "POST") {
      const body = await req.text();
      fetchInit.body = body || "{}";
    }

    const response = await fetch(fullUrl, fetchInit);
    const validationError = await validateResponse(response, fullUrl);
    if (validationError) return validationError;

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(error);

    if (
      error instanceof SyntaxError &&
      error.message.includes("Unexpected token")
    ) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch data. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  return handleRequest(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return handleRequest(req, ctx);
}
