/**
 * Dashboard Widget Type Definitions
 *
 * Types for the unified widget-based dashboard system allowing users to create
 * nested dashboard structures with containers and dashlets.
 */

/** Number of columns in the dashboard grid */
export const GRID_COLS = 24;

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
export type DashletCategory = "containers" | "data-display";

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
  /** PgREST function to call */
  pgrestFunctionName: string;
  /** HTTP method */
  pgrestHttpMethod: PlannerHttpMethod;
  /** Parameters to pass to the function */
  pgrestParams: PlannerParam[];
  /** Optional data source ID */
  dataSourceId?: string;
  /** Persisted response column keys (populated on successful fetch) */
  schema?: string[];
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

