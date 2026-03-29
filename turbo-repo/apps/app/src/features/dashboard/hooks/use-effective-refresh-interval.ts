import { useDashboard } from "../context/dashboard-context";

/**
 * Resolves the effective polling interval for a widget in milliseconds.
 *
 * Priority:
 * 1. Widget-level `config.refreshInterval` (number in seconds) overrides dashboard setting.
 *    - Explicit `0` means the widget opts out of polling.
 *    - `"inherit"` or absent means use the dashboard setting.
 * 2. Dashboard-level `refreshInterval` (from context).
 * 3. Returns 0 (off) when edit mode is active.
 */
export function useEffectiveRefreshInterval(
  widgetConfig: Record<string, unknown>,
): number {
  const { refreshInterval: dashboardInterval, editMode } = useDashboard();

  if (editMode) return 0;

  const widgetValue = widgetConfig.refreshInterval;

  // Widget explicitly sets a numeric interval (including 0 = off)
  if (typeof widgetValue === "number") {
    return widgetValue * 1000;
  }

  // "inherit" or absent → fall through to dashboard setting
  return (dashboardInterval ?? 0) * 1000;
}
