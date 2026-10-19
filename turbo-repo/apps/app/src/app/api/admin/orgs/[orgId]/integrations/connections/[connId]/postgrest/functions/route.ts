import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET /api/admin/orgs/[orgId]/integrations/connections/[connId]/postgrest/functions
 *
 * Lists the RPC functions a PostgREST connection exposes. Proxies to Quarkus
 * `GET /api/v1/orgs/{orgId}/integrations/connections/{connId}/postgrest/functions`.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; connId: string }> }
) {
  const { orgId, connId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/connections/${encodeURIComponent(connId)}/postgrest/functions`
  );
}
