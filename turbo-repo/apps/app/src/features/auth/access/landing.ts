import { getRouteRule } from "../config/route-permissions";
import { decideAccess } from "./access-control";

/** Pages a person can land on after signing in, in the order they are offered. */
export const LANDING_PAGES = [
  "/shipping",
  "/calendar",
  "/symptoms",
  "/where-is-my-load",
  "/finished",
  "/geographic-view",
  "/home",
  "/reports",
  "/whatsapp/conversations",
  "/collaborators-management",
  "/live-streams/devices",
  "/admin/console/message-templates",
] as const;

/**
 * The first module page these permissions open: `preferred` (the deployment's home) when allowed, else the first of
 * {@link LANDING_PAGES}. Null when none is. Pages that need no permission are not module pages and never count.
 */
export function firstAllowedPage(
  permissions: readonly string[] | null,
  preferred: string
): string | null {
  for (const path of [preferred, ...LANDING_PAGES]) {
    const rule = getRouteRule(path);
    const gated = (rule.requiredPermissions?.length ?? 0) > 0;
    if (gated && decideAccess(rule, permissions)) return path;
  }
  return null;
}
