import { getRouteRule } from "../config/route-permissions";
import { decideAccess } from "./access-control";
import {
  boardEnabled,
  boardOfPath,
} from "@/features/layout/models/board-module";
import {
  dashboardModuleEnabled,
  dashboardOfPath,
} from "@/features/layout/models/dashboard-module";

/** Pages a person can land on after signing in, in the order they are offered. */
export const LANDING_PAGES = [
  "/shipping",
  "/trips/dispatch",
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
  "/dashboards",
] as const;

/**
 * The first module page these permissions open: `preferred` (the deployment's home) when allowed, else the first of
 * {@link LANDING_PAGES}. Null when none is. The enabled server dashboard is an explicit module candidate under
 * its existing open route rule. Other open routes never count, nor do modules the deployment turns off.
 */
export function firstAllowedPage(
  permissions: readonly string[] | null,
  preferred: string,
  boardModule?: string,
  dashboardModule?: string,
  dashboardServerEnabled = false
): string | null {
  for (const path of [preferred, ...LANDING_PAGES]) {
    const board = boardOfPath(path);
    if (board && !boardEnabled(board, boardModule)) continue;
    const dashboard = dashboardOfPath(path);
    if (dashboard && !dashboardModuleEnabled(dashboard, dashboardModule))
      continue;
    if (dashboard === "server" && !dashboardServerEnabled) continue;
    const rule = getRouteRule(path);
    const gated = (rule.requiredPermissions?.length ?? 0) > 0;
    const eligible = gated || dashboard === "server";
    if (eligible && decideAccess(rule, permissions)) return path;
  }
  return null;
}
