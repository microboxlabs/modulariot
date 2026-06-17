/**
 * Dashboard Widget Type Definitions
 *
 * Types for the unified widget-based dashboard system allowing users to create
 * nested dashboard structures with containers and dashlets.
 */

/** Base / minimum grid column count. Stored widget layouts use these units. */
export const GRID_COLS = 24;

/** Width (px) that GRID_COLS columns occupy at scale 1 (calibrated for 1080p). */
export const DESIGN_WIDTH = 1600;

/**
 * View-mode upper bound on the fill-to-fit scale, so the grid does not become
 * oversized on 4K / ultrawide monitors (beyond it the grid is centered).
 */
export const MAX_SCALE = 1.35;

/** Refresh interval in seconds (0 = off) */
export type RefreshInterval = 0 | 10 | 30 | 60 | 300;

/** Options for refresh interval UI selects (value in seconds, i18n suffix key) */
export const REFRESH_INTERVAL_OPTIONS: readonly {
  value: RefreshInterval;
  /** Short i18n key suffix under `dashboard.settings.*` */
  labelKey: string;
}[] = [
  { value: 0, labelKey: "refreshOff" },
  { value: 10, labelKey: "refresh10s" },
  { value: 30, labelKey: "refresh30s" },
  { value: 60, labelKey: "refresh60s" },
  { value: 300, labelKey: "refresh5m" },
] as const;

/** Grid layout item compatible with react-grid-layout */
export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Minimum width in grid units */
  minW?: number;
  /** Minimum height in grid units */
  minH?: number;
  /** Maximum width in grid units */
  maxW?: number;
  /** Maximum height in grid units */
  maxH?: number;
}

/**
 * Unified Widget Model
 * Everything in the dashboard is a Widget with a componentId referencing the dashlet registry
 */
export interface Widget {
  /** Unique identifier (UUID) */
  id: string;
  /** References dashlet registry (e.g., 'container', 'labeled-container', 'card') */
  componentId: string;
  /** Grid layout position and size */
  layout: GridLayoutItem;
  /** Dashlet-specific configuration */
  config: Record<string, unknown>;
  /** Nested widgets (for container types) */
  children?: Widget[];
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

/** Dashlet categories for grouping in selector */
export type DashletCategory = "containers" | "data-display" | "actions";

/** User preferences for the dashboard */
export interface DashboardPreferences {
  /** Last edit mode state */
  editMode: boolean;
}

/** Planner request parameter (inline to avoid circular deps with pgrest-types) */
export interface PlannerParam {
  key: string;
  value: string;
}

/** HTTP method for planner requests */
export type PlannerHttpMethod = "POST" | "GET";

/** A single named request definition in the Request Planner */
export interface PlannerRequestDefinition {
  /** Unique identifier (UUID) */
  id: string;
  /** User-assigned variable name (e.g. "fleet_stats") */
  variableName: string;
  /** PgREST path (e.g. "rpc/my_function" or "my_table") */
  pgrestFunctionName: string;
  /** HTTP method */
  pgrestHttpMethod: PlannerHttpMethod;
  /** Parameters to pass */
  pgrestParams: PlannerParam[];
  /** Optional data source ID */
  dataSourceId?: string;
  /** Persisted response column keys (populated on successful fetch) */
  schema?: string[];
}

/** A single selectable option for a "select" filter */
export interface DashboardFilterOption {
  label: string;
  value: string;
}

/** A filter parameter available in the dashboard filter bar */
export interface DashboardFilterParam {
  /** URL param key (e.g., "asset_id", "date_range") */
  key: string;
  /** Display label shown in the filter bar */
  label: string;
  /** Filter type */
  type: "text" | "date_range" | "select";
  /** When true, setting this filter clears all other filters */
  unique?: boolean;
  /** Predefined options (only for type "select") */
  options?: DashboardFilterOption[];
}

/** Versioned storage schema for dashboard config (supports migrations) */
export interface DashboardStorageSchema {
  /** Schema version for migrations */
  version: 2;
  /** Dashboard display name */
  name: string;
  /** Root-level widgets (recursive tree structure) */
  widgets: Widget[];
  /** User preferences */
  preferences: DashboardPreferences;
  /** Request Planner definitions (optional, backward compatible) */
  requestPlanner?: PlannerRequestDefinition[];
  /** Filter bar configuration (optional, backward compatible) */
  filters?: DashboardFilterParam[];
  /** Auto-refresh interval in seconds (0 = off, default off) */
  refreshInterval?: RefreshInterval;
  /** Sidebar display order (lower numbers appear first; unset = last) */
  order?: number;
  /** Optional group-based access control. When non-empty, user must belong to
   *  at least one listed group (in addition to GROUP_DASHBOARD) to view this
   *  dashboard. When empty/undefined, any GROUP_DASHBOARD user can access. */
  allowedGroups?: string[];
}

/**
 * Parse an unknown allowedGroups value into a validated result.
 * - `{ valid: true, groups: string[] }` when value is a proper string array (may be empty)
 * - `{ valid: true, groups: undefined }` when value is absent (undefined/null)
 * - `{ valid: false }` when value is present but malformed
 */
export function parseAllowedGroups(
  value: unknown
): { valid: true; groups: string[] | undefined } | { valid: false } {
  if (value === undefined || value === null) return { valid: true, groups: undefined };
  if (!Array.isArray(value)) return { valid: false };
  if (!value.every((g): g is string => typeof g === "string")) return { valid: false };
  return { valid: true, groups: value };
}

/** Default storage state */
export const DEFAULT_STORAGE: DashboardStorageSchema = {
  version: 2,
  name: "My Dashboard",
  widgets: [],
  preferences: {
    editMode: false,
  },
};

