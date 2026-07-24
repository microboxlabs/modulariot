import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** Require the modulith-owned OWNER role for sensitive organization settings. */
export async function requireOrganizationOwner(
  orgSlug: string
): Promise<NextResponse | null> {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const organization = result.scope.availableOrgs.find(
    (candidate) => candidate.slug === orgSlug
  );
  if (organization?.role === "OWNER") return null;

  return NextResponse.json(
    { error: "Organization owner access required" },
    { status: 403 }
  );
}
