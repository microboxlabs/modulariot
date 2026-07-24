import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET  /api/admin/orgs/[orgId]/integrations/gps-webhooks — list subscriptions
 * POST /api/admin/orgs/[orgId]/integrations/gps-webhooks — create subscription
 *
 * StreamHub-domain control plane (GPS). Uses {@code MIOT_STREAMHUB_API_URL}
 * (falls back to {@code MIOT_RESOURCE_URL}) — not the coordinator-only helper.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${safe}/integrations/gps-webhooks`
  );
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
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${safe}/integrations/gps-webhooks`,
    { method: "POST", body }
  );
}
