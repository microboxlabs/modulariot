import { useOptionalDashboard } from "../context/dashboard-context";

/**
 * Resolves the effective polling interval for a widget in milliseconds.
 *
 * Priority:
 * 1. Widget-level `config.refreshInterval` (number in seconds) overrides dashboard setting.
 *    - Explicit `0` means the widget opts out of polling.
 *    - `"inherit"` or absent means use the dashboard setting.
 * 2. Dashboard-level `refreshInterval` (from context).
 * 3. Returns 0 (off) when edit mode is active.
 *
 * Falls back to a safe "no dashboard, no polling" default (via
 * useOptionalDashboard) when rendered outside a DashboardProvider — e.g. a
 * dashlet rendered standalone in harness-chat.
 */
export function useEffectiveRefreshInterval(
  widgetConfig: Record<string, unknown>,
): number {
  const { refreshInterval: dashboardInterval, editMode } = useOptionalDashboard();

  if (editMode) return 0;

  const widgetValue = widgetConfig.refreshInterval;

  // Widget explicitly sets a numeric interval (including 0 = off)
  if (typeof widgetValue === "number" && Number.isFinite(widgetValue) && widgetValue >= 0) {
    return widgetValue * 1000;
  }

  // "inherit" or absent → fall through to dashboard setting
  const di = dashboardInterval ?? 0;
  return Number.isFinite(di) && di >= 0 ? di * 1000 : 0;
}
