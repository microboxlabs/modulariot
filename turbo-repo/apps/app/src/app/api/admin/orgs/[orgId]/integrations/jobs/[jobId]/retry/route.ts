import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** Manually reset a parked job so workers pick it up again. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; jobId: string }> },
) {
  const { orgId, jobId } = await params;
  const safeOrg = encodeURIComponent(orgId);
  const safeJob = encodeURIComponent(jobId);
  return forwardToQuarkus(
    `/api/v1/orgs/${safeOrg}/integrations/console/jobs/${safeJob}/retry`,
    { method: "POST" },
  );
}
