import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** List the org's integration jobs (state/jobType/chainKey/limit filters). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  const query = new URL(request.url).searchParams.toString();
  const suffix = query ? `?${query}` : "";
  return forwardToQuarkus(`/api/v1/orgs/${safe}/integrations/console/jobs${suffix}`);
}
