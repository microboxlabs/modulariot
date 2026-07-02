import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * PATCH /api/admin/orgs/[orgId]/integrations/connections/[connId]
 *
 * Partial update of an integration connection (name / baseUrl / metadata, and an
 * optional token rotation). Proxies to Quarkus
 * `PATCH /api/v1/orgs/{orgId}/integrations/connections/{connId}`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; connId: string }> },
) {
  const { orgId, connId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/connections/${encodeURIComponent(connId)}`,
    { method: "PATCH", body },
  );
}
