import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * DELETE /api/admin/orgs/[orgId]/integrations/bindings/[bindingId] — unbind.
 *
 * Proxies to Quarkus. Only the owning org may remove a binding: one inherited
 * from a parent is visible but not this org's to delete, and Quarkus answers 404
 * for it rather than 403 — it does not exist as *their* binding.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; bindingId: string }> },
) {
  const { orgId, bindingId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safeOrg = encodeURIComponent(orgId);
  const safeBinding = encodeURIComponent(bindingId);
  return forwardToQuarkus(
    `/api/v1/orgs/${safeOrg}/integrations/bindings/${safeBinding}`,
    { method: "DELETE" },
  );
}
