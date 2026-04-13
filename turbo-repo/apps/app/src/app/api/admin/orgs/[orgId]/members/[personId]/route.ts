import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * DELETE /api/admin/orgs/[orgId]/members/[personId]
 *
 * Proxies to Quarkus `DELETE /api/v1/orgs/{orgId}/members/{personId}`.
 * Requires SITE_MANAGER on the parent organization; enforced server-side
 * by WriteAuthorizer.
 */
export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ orgId: string; personId: string }> },
) {
  const { orgId, personId } = await params;
  const safeOrg = encodeURIComponent(orgId);
  const safePerson = encodeURIComponent(personId);
  return forwardToQuarkus(
    `/api/v1/orgs/${safeOrg}/members/${safePerson}`,
    { method: "DELETE" },
  );
}
