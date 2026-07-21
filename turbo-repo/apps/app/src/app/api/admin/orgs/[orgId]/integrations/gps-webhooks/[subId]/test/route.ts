import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { requireOrganizationSettingsAdmin } from "@/app/api/utils/organization-settings-admin";

/**
 * POST /api/admin/orgs/[orgId]/integrations/gps-webhooks/[subId]/test
 * Sends a synthetic sample payload to the customer webhook URL.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; subId: string }> },
) {
  const { orgId, subId } = await params;
  const denied = await requireOrganizationSettingsAdmin(orgId);
  if (denied) return denied;
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/gps-webhooks/${encodeURIComponent(subId)}/test`,
    { method: "POST", body: {} },
  );
}
