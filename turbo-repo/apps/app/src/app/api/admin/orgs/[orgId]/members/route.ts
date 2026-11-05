import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/orgs/[orgId]/members — list members
 *
 * Proxies to Quarkus `GET /api/v1/orgs/{orgId}/members`. The backend's
 * OrganizationRequestFilter requires org membership. Members are added and
 * removed on the Team page.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/members`);
}
