import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/orgs — every active organization
 * POST /api/admin/platform/orgs — create a top-level organization
 *
 * Proxies to Quarkus `/api/v1/platform/orgs`, which requires platform
 * ownership.
 */
export async function GET() {
  return forwardToQuarkus("/api/v1/platform/orgs");
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus("/api/v1/platform/orgs", { method: "POST", body });
}
