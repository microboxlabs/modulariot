import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** Per-state counts + live-stream subscription context for the job console. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/console/jobs/overview`);
}
