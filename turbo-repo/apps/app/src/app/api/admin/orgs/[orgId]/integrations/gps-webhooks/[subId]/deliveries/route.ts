import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { requireOrganizationSettingsAdmin } from "@/app/api/utils/organization-settings-admin";

/**
 * GET /api/admin/orgs/[orgId]/integrations/gps-webhooks/[subId]/deliveries
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string; subId: string }> },
) {
  const { orgId, subId } = await params;
  const denied = await requireOrganizationSettingsAdmin(orgId);
  if (denied) return denied;
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const query = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/gps-webhooks/${encodeURIComponent(subId)}/deliveries${query}`,
  );
}
