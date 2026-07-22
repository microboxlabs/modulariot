import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/** Create or replace the failure-notification rule for a job type. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string; jobType: string }> },
) {
  const { orgId, jobType } = await params;
  const safeOrg = encodeURIComponent(orgId);
  const safeType = encodeURIComponent(jobType);
  return forwardToQuarkus(
    `/api/v1/orgs/${safeOrg}/integrations/console/notification-rules/${safeType}`,
    { method: "PUT", body: await request.json() },
  );
}

/** Delete the failure-notification rule for a job type. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string; jobType: string }> },
) {
  const { orgId, jobType } = await params;
  const safeOrg = encodeURIComponent(orgId);
  const safeType = encodeURIComponent(jobType);
  const query = new URL(request.url).searchParams.toString();
  const suffix = query ? `?${query}` : "";
  return forwardToQuarkus(
    `/api/v1/orgs/${safeOrg}/integrations/console/notification-rules/${safeType}${suffix}`,
    { method: "DELETE" },
  );
}
