import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { NextResponse } from "next/server";

/**
 * Returns the caller's resolved organization scopes.
 * Used by the org-switcher client component to populate the dropdown.
 */
export async function GET() {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  return NextResponse.json({
    activeOrg: result.scope.activeOrg,
    availableOrgs: result.scope.availableOrgs,
  });
}
