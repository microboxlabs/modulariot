/**
 * The persisted dashboard document.
 *
 * This is the thing a dashboard *is*: what the UI writes and the server
 * stores. Both halves have to agree on it exactly, which is why it lives here
 * rather than in either of them.
 *
 * Moved from `apps/app` (`features/dashboard/types/dashboard.types.ts`), by
 * way of the UI package's extraction. Three things that came along in that
 * file were deliberately left behind, because only one side ever reads them:
 * `MAX_SCALE` (how far a viewport may scale the grid),
 * `REFRESH_INTERVAL_OPTIONS` (a select's options, carrying i18n keys) and
 * `DashletCategory` (how a picker groups the registry). A second
 * implementation of either half can be written without knowing any of them.
 */

/**
 * Grid width, in columns, that stored layouts are expressed in.
 *
 * Part of the contract rather than a rendering choice: `GridLayoutItem.x` and
 * `.w` are counts of these columns, so a renderer using a different number
 * places every widget in the wrong column.
 */
export const GRID_COLS = 24;

/**
 * Width in pixels that `GRID_COLS` columns occupy at scale 1.
 *
 * Also contractual, for the same reason: it is the only thing that says how
 * wide a stored column is, and therefore what aspect ratio an author saw.
 */
export const DESIGN_WIDTH = 1600;

/** Auto-refresh interval in seconds. 0 is off. */
export type RefreshInterval = 0 | 10 | 30 | 60 | 300;

/** Position and size of one widget, in `GRID_COLS` units. */
export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

/**
 * Everything on a dashboard is a widget, including the containers other
 * widgets sit in. `componentId` names an entry in the renderer's dashlet
 * registry; this contract does not say what registry entries exist, only that
 * the document names one.
 */
export interface Widget {
  /** Unique within the document. */
  id: string;
  componentId: string;
  layout: GridLayoutItem;
  /** Whatever the named dashlet needs. Opaque here on purpose. */
  config: Record<string, unknown>;
  /** Present on container widgets. */
  children?: Widget[];
  /** ISO-8601. */
  createdAt: string;
  /** ISO-8601. */
  updatedAt: string;
}

export interface DashboardPreferences {
  editMode: boolean;
}

export interface PlannerParam {
  key: string;
  value: string;
}

export type PlannerHttpMethod = "POST" | "GET";

/** One named request the dashboard issues, and binds widgets to. */
export interface PlannerRequestDefinition {
  id: string;
  /** What widgets refer to the result by. */
  variableName: string;
  /** A path, such as `rpc/my_function` or `my_table`. */
  pgrestFunctionName: string;
  pgrestHttpMethod: PlannerHttpMethod;
  pgrestParams: PlannerParam[];
  dataSourceId?: string;
  /** Response column keys, recorded on a successful fetch. */
  schema?: string[];
}

export interface DashboardFilterOption {
  label: string;
  value: string;
}

/** One control in the dashboard's filter bar. */
export interface DashboardFilterParam {
  /** URL parameter key, such as `asset_id`. */
  key: string;
  label: string;
  type: "text" | "date_range" | "select";
  /** Setting this filter clears the others. */
  unique?: boolean;
  /** Only meaningful for type `select`. */
  options?: DashboardFilterOption[];
}

/** The document. `version` is what makes it safe to change this shape. */
export interface DashboardStorageSchema {
  version: 2;
  name: string;
  /** The widget tree. Containers hold their children. */
  widgets: Widget[];
  preferences: DashboardPreferences;
  requestPlanner?: PlannerRequestDefinition[];
  filters?: DashboardFilterParam[];
  refreshInterval?: RefreshInterval;
  /** Sidebar position; lower sorts first, unset sorts last. */
  order?: number;
  /**
   * Group-based audience. Non-empty means a viewer must belong to at least one
   * of these groups; absent or empty means the host's own access rules decide
   * alone. Written here because it is stored in the document, but what a group
   * *is* belongs to the host, so this contract never resolves one.
   */
  allowedGroups?: string[];
}

/** A new, empty dashboard. */
export const DEFAULT_STORAGE: DashboardStorageSchema = {
  version: 2,
  name: "My Dashboard",
  widgets: [],
  preferences: {
    editMode: false,
  },
};
