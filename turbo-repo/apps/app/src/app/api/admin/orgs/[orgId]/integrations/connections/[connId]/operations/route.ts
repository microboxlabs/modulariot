import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

type Params = { params: Promise<{ orgId: string; connId: string }> };

const path = (orgId: string, connId: string) =>
  `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/connections/${encodeURIComponent(connId)}/operations`;

/**
 * GET /api/admin/orgs/[orgId]/integrations/connections/[connId]/operations
 *
 * Lists a connection's operations. Proxies to Quarkus
 * `GET /api/v1/orgs/{orgId}/integrations/connections/{connId}/operations`.
 */
export async function GET(_request: Request, { params }: Params) {
  const { orgId, connId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToQuarkus(path(orgId, connId));
}

/**
 * POST /api/admin/orgs/[orgId]/integrations/connections/[connId]/operations
 *
 * Adds an operation to a connection, such as a BigQuery query. Proxies to Quarkus
 * `POST /api/v1/orgs/{orgId}/integrations/connections/{connId}/operations`.
 */
export async function POST(request: Request, { params }: Params) {
  const { orgId, connId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(path(orgId, connId), { method: "POST", body });
}
