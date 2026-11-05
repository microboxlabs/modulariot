import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * GET / POST /api/admin/platform/data-sharing/... — data shares between
 * organizations. Proxies to `/api/v1/platform/data-sharing/...` on the modulith
 * next to the GPS data, which requires platform ownership. Always with the
 * user's session: the ownership check reads the token's email, and an M2M
 * token has none.
 */
interface RouteParams {
  params: Promise<{ path: string[] }>;
}

const SEGMENT = /^[A-Za-z0-9._-]+$/;

async function upstreamPath({ params }: RouteParams): Promise<string | null> {
  const { path } = await params;
  if (!path.every((s) => SEGMENT.test(s) && s !== "." && s !== "..")) {
    return null;
  }
  return `/api/v1/platform/data-sharing/${path.join("/")}`;
}

const badPath = () =>
  NextResponse.json({ error: "Invalid path" }, { status: 400 });

export async function GET(_request: Request, context: RouteParams) {
  const path = await upstreamPath(context);
  if (!path) return badPath();
  return forwardToStreamhubModulith(path, { sessionOnly: true });
}

export async function POST(request: Request, context: RouteParams) {
  const path = await upstreamPath(context);
  if (!path) return badPath();
  let body: unknown = {};
  const text = await request.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  return forwardToStreamhubModulith(path, {
    method: "POST",
    body,
    sessionOnly: true,
  });
}
