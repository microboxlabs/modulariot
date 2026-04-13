import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/orgs/[orgId]/modules
 *
 * Proxies to Quarkus GET /api/v1/orgs/{orgId}/modules. Returns the list of
 * enabled module codes for the organization. Gated by
 * OrganizationRequestFilter on the backend.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/modules`);
}
