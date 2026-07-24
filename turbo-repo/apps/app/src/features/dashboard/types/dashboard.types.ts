/**
 * Dashboard widget types — moved to @microboxlabs/miot-dashboard-ui (P1).
 *
 * This shim keeps existing app import paths working during the extraction;
 * new code should import from the package directly.
 */

export {
  GRID_COLS,
  DESIGN_WIDTH,
  MAX_SCALE,
  REFRESH_INTERVAL_OPTIONS,
  parseAllowedGroups,
  DEFAULT_STORAGE,
} from "@microboxlabs/miot-dashboard-ui";

export type {
  RefreshInterval,
  GridLayoutItem,
  Widget,
  DashletCategory,
  DashboardPreferences,
  PlannerParam,
  PlannerHttpMethod,
  PlannerRequestDefinition,
  DashboardFilterOption,
  DashboardFilterParam,
  DashboardStorageSchema,
} from "@microboxlabs/miot-dashboard-ui";
