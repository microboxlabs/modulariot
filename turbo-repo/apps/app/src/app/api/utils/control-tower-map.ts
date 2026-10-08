import "server-only";
import type { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * Reads the Control Tower map data of the caller's active organization from the
 * StreamHub modulith, with the user's session token. The modulith reads the GPS
 * database as that organization, so each organization sees only its own assets.
 */
export async function forwardControlTowerMap(
  resource: "positions" | "summary" | "conditions",
  search = ""
): Promise<NextResponse> {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${org}/control-tower/map/${resource}${search}`,
    { method: "GET" }
  );
}
