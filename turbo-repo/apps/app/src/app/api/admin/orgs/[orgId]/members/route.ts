import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/orgs/[orgId]/members
 *
 * Proxies to Quarkus GET /api/v1/orgs/{orgId}/members. The backend's
 * OrganizationRequestFilter is the authorization boundary — it validates
 * that the caller is a member of the org before returning the list.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/members`);
}
