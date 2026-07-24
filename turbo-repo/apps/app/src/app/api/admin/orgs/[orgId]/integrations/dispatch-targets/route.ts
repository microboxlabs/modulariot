import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET /api/admin/orgs/[orgId]/integrations/dispatch-targets — the channel picker's feed.
 *
 * Each active connection paired with its operations and that operation's field
 * contract, so the drawer does not fetch connections, then operations, then parse
 * every request_schema itself.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/dispatch-targets`);
}
