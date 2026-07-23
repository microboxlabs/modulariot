import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET  /api/admin/orgs/[orgId]/integrations/credential-profiles — list credentials
 * POST /api/admin/orgs/[orgId]/integrations/credential-profiles — create one
 *
 * Proxies to Quarkus `GET/POST /api/v1/orgs/{orgId}/integrations/credential-profiles`
 * (miot-integrations). Credentials hold secrets, so every route here requires
 * organization-owner access; Quarkus enforces the same role again per request.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/credential-profiles`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
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
  return forwardToQuarkus(
    `/api/v1/orgs/${safe}/integrations/credential-profiles`,
    { method: "POST", body }
  );
}
