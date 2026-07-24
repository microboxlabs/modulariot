import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET /api/admin/orgs/[orgId]/integrations/bindings — event bindings visible to this org
 * PUT /api/admin/orgs/[orgId]/integrations/bindings — create or replace one
 *
 * Proxies to Quarkus `GET/PUT /api/v1/orgs/{orgId}/integrations/bindings`
 * (miot-integrations). A binding decides which external system receives a review
 * verdict and under which credential, so it is organization-owner work; Quarkus
 * enforces the same role again per request.
 *
 * The list is parent-inclusive — an org sees its own bindings plus its parent's,
 * with the inherited ones flagged so the UI can show them read-only.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/bindings`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/bindings`, {
    method: "PUT",
    body,
  });
}
