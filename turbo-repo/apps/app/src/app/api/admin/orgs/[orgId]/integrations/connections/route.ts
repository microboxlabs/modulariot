import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET  /api/admin/orgs/[orgId]/integrations/connections — list connections
 * POST /api/admin/orgs/[orgId]/integrations/connections — create a connection
 *
 * Proxies to Quarkus `GET/POST /api/v1/orgs/{orgId}/integrations/connections`
 * (miot-integrations). Auth + tenant scoping are delegated to Quarkus.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/connections`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/connections`, {
    method: "POST",
    body,
  });
}
