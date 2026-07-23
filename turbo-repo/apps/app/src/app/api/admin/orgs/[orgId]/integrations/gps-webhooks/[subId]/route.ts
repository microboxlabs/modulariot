import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET/PATCH/DELETE /api/admin/orgs/[orgId]/integrations/gps-webhooks/[subId]
 * StreamHub-domain modulith (see MIOT_STREAMHUB_API_URL).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; subId: string }> }
) {
  const { orgId, subId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/gps-webhooks/${encodeURIComponent(subId)}`
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; subId: string }> }
) {
  const { orgId, subId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/gps-webhooks/${encodeURIComponent(subId)}`,
    { method: "PATCH", body }
  );
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; subId: string }> }
) {
  const { orgId, subId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/gps-webhooks/${encodeURIComponent(subId)}`,
    { method: "DELETE" }
  );
}
