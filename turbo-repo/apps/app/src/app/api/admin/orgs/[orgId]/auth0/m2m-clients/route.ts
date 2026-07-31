import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/orgs/[orgId]/auth0/m2m-clients?q=&limit=
 *
 * Backs the client-id autocomplete on the Auth0 credential form. Proxies to
 * miot-integrations, which computes entitlement from the organization tree —
 * the org's own `tenant_client_id` plus its children's.
 *
 * Answers identifiers and names only, never a secret. Organization-owner gated
 * like the credential routes it serves: the list is a map of the org's identity
 * surface, which is not something every member needs. Quarkus enforces the same
 * role again per request.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const parsedLimit = Number.parseInt(searchParams.get("limit") ?? "", 10);

  const upstream = new URLSearchParams();
  if (query) upstream.set("q", query);
  if (Number.isFinite(parsedLimit)) upstream.set("limit", String(parsedLimit));
  const suffix = upstream.toString() ? `?${upstream}` : "";

  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/auth0/clients${suffix}`
  );
}
