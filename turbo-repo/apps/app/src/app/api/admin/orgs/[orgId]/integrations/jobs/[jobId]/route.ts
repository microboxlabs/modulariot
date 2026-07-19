import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** One integration job with its full attempt history. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; jobId: string }> },
) {
  const { orgId, jobId } = await params;
  const safeOrg = encodeURIComponent(orgId);
  const safeJob = encodeURIComponent(jobId);
  return forwardToQuarkus(`/api/v1/orgs/${safeOrg}/integrations/console/jobs/${safeJob}`);
}
