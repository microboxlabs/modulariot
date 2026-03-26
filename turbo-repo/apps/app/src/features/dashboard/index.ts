/**
 * Dashboard Widget Feature
 *
 * A customizable widget-based dashboard system allowing users to create
 * nested dashboard structures with containers and dashlets.
 */

// Context
export { DashboardProvider, useDashboard } from "./context/dashboard-context";

// Components
export { DashboardView } from "./components/dashboard-view";
export { WidgetRenderer } from "./components/widget-renderer";
export { AddWidgetModal } from "./components/add-widget-modal/add-widget-modal";
export { EmptyState } from "./components/empty-state";

// Dashlets
export {
  getDashlet,
  getAllDashlets,
  getValidDashletsForParent,
  canNestIn,
} from "./dashlets";

// Types
export type {
  Widget,
  GridLayoutItem,
  DashletCategory,
  DashboardStorageSchema,
} from "./types/dashboard.types";

export type {
  DashletMeta,
  DashletDefinition,
  DashletComponentProps,
  DashletSettingsProps,
} from "./dashlets/types";
