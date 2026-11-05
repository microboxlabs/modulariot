import { streamFromQuarkus } from "@/app/api/utils/quarkus-proxy";

export const dynamic = "force-dynamic";

/** The org's job transitions as server-sent events, relayed from the modulith for the job console. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  return streamFromQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/console/jobs/events`,
    request.signal
  );
}
