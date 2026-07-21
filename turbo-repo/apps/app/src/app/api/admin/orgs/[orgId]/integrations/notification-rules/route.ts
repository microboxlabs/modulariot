import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** List the org's job-failure notification rules. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/console/notification-rules`);
}
