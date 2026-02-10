/**
 * Dashboard Widget Type Definitions
 *
 * Types for the unified widget-based dashboard system allowing users to create
 * nested dashboard structures with containers and dashlets.
 */

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
  /** Dashlet-specific configuration (persisted to localStorage) */
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

/** Versioned storage schema for localStorage (supports migrations) */
export interface DashboardStorageSchema {
  /** Schema version for migrations */
  version: 2;
  /** Root-level widgets (recursive tree structure) */
  widgets: Widget[];
  /** User preferences */
  preferences: DashboardPreferences;
}

/** Default storage state */
export const DEFAULT_STORAGE: DashboardStorageSchema = {
  version: 2,
  widgets: [],
  preferences: {
    editMode: false,
  },
};

/** localStorage key for dashboard data */
export const STORAGE_KEY = "dashboard-config";

/** Old storage key for migration */
export const OLD_STORAGE_KEY = "chartset-config";

// =============================================================================
// Legacy types for migration (v1 → v2)
// =============================================================================

/** @deprecated Legacy chart type - used for migration only */
export type LegacyChartType = "kpi" | "text" | "bar" | "line" | "pie" | "table";

/** @deprecated Legacy widget size - used for migration only */
export type LegacyWidgetSize = 1 | 2 | 3;

/** @deprecated Legacy chart widget - used for migration only */
export interface LegacyChartWidget {
  id: string;
  type: LegacyChartType;
  title: string;
  size: LegacyWidgetSize;
  layout?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  config: Record<string, unknown>;
}

/** @deprecated Legacy chartset - used for migration only */
export interface LegacyChartset {
  id: string;
  name: string;
  description: string;
  widgets: LegacyChartWidget[];
  createdAt: string;
  updatedAt: string;
}

/** @deprecated Legacy storage schema (v1) - used for migration only */
export interface LegacyStorageSchema {
  version: 1;
  chartsets: LegacyChartset[];
  preferences: {
    editMode: boolean;
  };
}
