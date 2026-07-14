import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * POST /api/admin/orgs/[orgId]/integrations/gps-webhooks/[subId]/test
 * Sends a synthetic sample payload to the customer webhook URL.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; subId: string }> },
) {
  const { orgId, subId } = await params;
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/gps-webhooks/${encodeURIComponent(subId)}/test`,
    { method: "POST", body: {} },
  );
}
