import "server-only";
import type { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * Reads the Control Tower map data of the caller's active organization from the
 * StreamHub modulith, always with the user's session token. The modulith reads the GPS
 * database as that organization, so each organization sees only its own assets.
 */
export async function forwardControlTowerMap(
  resource:
    | "positions"
    | "summary"
    | "conditions"
    | "symptoms"
    | `symptoms/${string}`
    | `trips/${string}`,
  search = ""
): Promise<NextResponse> {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${org}/control-tower/map/${resource}${search}`,
    { method: "GET", sessionOnly: true }
  );
}

/**
 * A date as the modulith expects it (ISO-8601). Links have always sent
 * "2026-10-15 00:00:00", with a space between date and time; that space
 * becomes the ISO "T". Other values pass unchanged.
 */
export function isoDate(value: string): string {
  const date = value.trim();
  if (date.length > 10 && date[10] === " ") {
    return `${date.slice(0, 10)}T${date.slice(11)}`;
  }
  return date;
}
