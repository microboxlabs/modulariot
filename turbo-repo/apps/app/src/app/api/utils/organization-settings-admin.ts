import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { hasAlfrescoAdminAccessForSession } from "@/features/auth/utils/admin-access";

const ORGANIZATION_ADMIN_ROLES = new Set(["SITE_MANAGER", "GROUP_ADMIN"]);

/**
 * Require organization-manager or Alfresco-administrator access to sensitive
 * organization settings proxy routes.
 */
export async function requireOrganizationSettingsAdmin(
  orgSlug: string
): Promise<NextResponse | null> {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const organization = result.scope.availableOrgs.find(
    (candidate) => candidate.slug === orgSlug
  );
  if (organization && ORGANIZATION_ADMIN_ROLES.has(organization.role)) {
    return null;
  }

  if (await hasAlfrescoAdminAccessForSession(result.session)) {
    return null;
  }

  return NextResponse.json(
    { error: "Organization administrator access required" },
    { status: 403 }
  );
}
