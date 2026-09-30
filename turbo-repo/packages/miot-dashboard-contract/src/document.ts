/** The persisted dashboard document: what a renderer writes and a server stores. */

/** Grid width in columns. `GridLayoutItem.x` and `.w` count these. */
export const GRID_COLS = 24;

/** Width in pixels that `GRID_COLS` columns occupy at scale 1. */
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
 * Everything on a dashboard is a widget, containers included. `componentId`
 * names an entry in the renderer's registry; this package does not say which
 * entries exist.
 */
export interface Widget {
  /** Unique within the document. */
  id: string;
  componentId: string;
  layout: GridLayoutItem;
  /** Whatever the named dashlet needs. Opaque to this package. */
  config: Record<string, unknown>;
  /** Present on container widgets. */
  children?: Widget[];
  /** ISO-8601. Write one; the schema does not reject an older format. */
  createdAt: string;
  /** ISO-8601. Write one; the schema does not reject an older format. */
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

/** Values passed to a stored operation; never executable expressions. */
export type DashboardQueryScalar = string | number | boolean | null;
export type DashboardQueryValue = DashboardQueryScalar | DashboardQueryScalar[];

/** Bind a fixed value or a named dashboard filter to an operation parameter. */
export type DashboardQueryParameter =
  | { kind: "literal"; value: DashboardQueryValue }
  | {
      kind: "filter";
      key: string;
      defaultValue?: DashboardQueryValue;
      /** Omit a missing or empty-string value after applying the default. */
      omitWhenEmpty?: boolean;
    };

/**
 * A named query over a host-owned connection operation. The host owns the
 * endpoint/SQL, credentials and tenant predicates; none are supplied by viewers.
 */
export interface DashboardQueryDefinition {
  id: string;
  variableName: string;
  connectionId: string;
  operationId: string;
  parameters: Record<string, DashboardQueryParameter>;
  /** Optional known response columns, for an editor before the first query. */
  schema?: string[];
}

export interface DashboardFilterOption {
  label: string;
  value: string;
}

/** Metadata-only reference to an already authorized named query result. */
export interface DashboardFilterOptionsSource {
  /** Saved query variable name; legacy hosts may provide planner results. */
  variableName: string;
  valueField: string;
  /** Defaults to valueField. */
  labelField?: string;
}

/** One control in the dashboard's filter bar. */
export interface DashboardFilterParam {
  /** URL parameter key, such as `asset_id`. */
  key: string;
  label: string;
  type: "text" | "date_range" | "select";
  /**
   * Setting a nonempty value clears this definition's other keys (date-range
   * from/to). Unrelated filter definitions are preserved.
   */
  unique?: boolean;
  /** Only meaningful for type `select`. */
  options?: DashboardFilterOption[];
  /** Select at most one value; hosts decide how values map to query parameters. */
  single?: boolean;
  /** Derive select options from named results, without adding an execution endpoint. */
  optionsSource?: DashboardFilterOptionsSource;
}

/** The document. `version` is how this shape changes later. */
export interface DashboardStorageSchema {
  version: 2;
  name: string;
  /** The widget tree. Containers hold their children. */
  widgets: Widget[];
  preferences: DashboardPreferences;
  requestPlanner?: PlannerRequestDefinition[];
  /** Connection-backed queries for the independent dashboard server. */
  queries?: DashboardQueryDefinition[];
  filters?: DashboardFilterParam[];
  refreshInterval?: RefreshInterval;
  /** Sidebar position; lower sorts first, unset sorts last. */
  order?: number;
  /**
   * Non-empty means a viewer must belong to one of these groups. Absent or
   * empty leaves it to the host's own access rules. The host defines what a
   * group is; this package never resolves one.
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
