import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET  /api/admin/orgs/[orgId]/integrations/templates — list templates
 * POST /api/admin/orgs/[orgId]/integrations/templates — create a template
 *
 * Proxies to Quarkus `GET/POST /api/v1/orgs/{orgId}/integrations/templates`
 * (miot-integrations). A template is an operator-defined integration type; every
 * route requires organization-owner access and Quarkus enforces it again.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/templates`);
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
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/templates`, {
    method: "POST",
    body,
  });
}
