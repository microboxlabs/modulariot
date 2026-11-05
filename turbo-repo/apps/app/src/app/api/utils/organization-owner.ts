import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isPlatformScope } from "@/features/common/platform-scope";

/** Require the modulith-owned OWNER role, or platform ownership for the platform scope. */
export async function requireOrganizationOwner(
  orgSlug: string
): Promise<NextResponse | null> {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const organization = result.scope.availableOrgs.find(
    (candidate) => candidate.slug === orgSlug
  );
  if (organization?.role === "OWNER") return null;
  // The platform scope is offered only to platform owners; the modulith checks again.
  if (isPlatformScope(orgSlug) && organization?.role === "PLATFORM_OWNER") {
    return null;
  }

  return NextResponse.json(
    { error: "Organization owner access required" },
    { status: 403 }
  );
}
