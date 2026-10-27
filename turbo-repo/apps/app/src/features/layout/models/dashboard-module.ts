/**
 * `DASHBOARD_MODULE` picks the dashboards a deployment shows: "legacy" (Home,
 * the dashboards stored in the app) or "server" (Dashboards, served by the
 * dashboard server, which also needs `ENABLE_DASHBOARD_SERVER`). Any other
 * value, including empty, shows both.
 */
export type DashboardModule = "legacy" | "server";

export function dashboardModuleEnabled(
  module: DashboardModule,
  setting: string | null | undefined
): boolean {
  const value = setting?.trim().toLowerCase();
  return (value !== "legacy" && value !== "server") || value === module;
}

/** Whether a path is one of the legacy dashboard pages. */
export function isLegacyDashboardPath(path: string): boolean {
  return path === "/home" || path.startsWith("/home/");
}
