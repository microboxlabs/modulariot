import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * POST /api/admin/orgs/[orgId]/integrations/credential-profiles/[credentialId]/test
 *
 * Exercises a stored credential — for client credentials, a real token grant — and
 * records the outcome on it. Proxies to Quarkus
 * `POST /api/v1/orgs/{orgId}/integrations/credential-profiles/{id}/test`.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; credentialId: string }> },
) {
  const { orgId, credentialId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/credential-profiles/${encodeURIComponent(credentialId)}/test`,
    { method: "POST", body: {} },
  );
}
