import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/orgs/[orgId]/harness-plan — seats, access and this month's
 * token pool
 * PUT /api/admin/orgs/[orgId]/harness-plan — set seats, billing cycle and
 * who may use the harness
 *
 * Proxies to Quarkus `/api/v1/orgs/{orgId}/harness-plan`; both need
 * SITE_MANAGER on the parent org or the platform owner role.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/harness-plan`
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/harness-plan`,
    { method: "PUT", body }
  );
}
