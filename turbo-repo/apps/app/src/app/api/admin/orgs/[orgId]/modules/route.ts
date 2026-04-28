import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/orgs/[orgId]/modules   — list enabled modules
 * PUT /api/admin/orgs/[orgId]/modules   — replace enabled modules
 *
 * Proxies to Quarkus `GET/PUT /api/v1/orgs/{orgId}/modules`. GET is gated
 * by org membership; PUT requires SITE_MANAGER on the parent.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/modules`);
}

export async function PUT(
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
  return forwardToQuarkus(`/api/v1/orgs/${safe}/modules`, {
    method: "PUT",
    body,
  });
}
