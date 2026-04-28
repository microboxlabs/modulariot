import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * PATCH  /api/admin/orgs/[orgId]   — edit displayName / taxId
 * DELETE /api/admin/orgs/[orgId]   — soft-delete (sets active=false)
 *
 * Proxies to Quarkus `PATCH/DELETE /api/v1/orgs/{orgId}`. Both require
 * SITE_MANAGER on the parent org (enforced by WriteAuthorizer).
 */
export async function PATCH(
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
  return forwardToQuarkus(`/api/v1/orgs/${safe}`, {
    method: "PATCH",
    body,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}`, { method: "DELETE" });
}
