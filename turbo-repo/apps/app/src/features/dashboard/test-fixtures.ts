import type {
  Widget,
  GridLayoutItem,
  DashboardStorageSchema,
  DashboardFilterParam,
  PlannerRequestDefinition,
} from "./types/dashboard.types";
import type { PgrestParam } from "./dashlets/common/pgrest-types";
import type { FilterItemConfig, FilterConfig } from "./dashlets/common/filter-types";
import type { TableColumn } from "./dashlets/common/column-types";

export function makeLayout(overrides?: Partial<GridLayoutItem>): GridLayoutItem {
  return {
    i: "widget-1",
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    ...overrides,
  };
}

export function makeWidget(overrides?: Partial<Widget>): Widget {
  return {
    id: "widget-1",
    componentId: "card",
    layout: makeLayout({ i: overrides?.id ?? "widget-1" }),
    config: {},
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeDashboardStorage(
  overrides?: Partial<DashboardStorageSchema>,
): DashboardStorageSchema {
  return {
    version: 2,
    name: "Test Dashboard",
    widgets: [],
    preferences: { editMode: false },
    ...overrides,
  };
}

export function makeFilterParam(
  overrides?: Partial<DashboardFilterParam>,
): DashboardFilterParam {
  return {
    key: "status",
    label: "Status",
    type: "text",
    ...overrides,
  };
}

export function makePlannerDefinition(
  overrides?: Partial<PlannerRequestDefinition>,
): PlannerRequestDefinition {
  return {
    id: "planner-1",
    variableName: "fleet_stats",
    pgrestFunctionName: "get_fleet_stats",
    pgrestHttpMethod: "POST",
    pgrestParams: [],
    ...overrides,
  };
}

export function makePgrestParam(
  overrides?: Partial<PgrestParam>,
): PgrestParam {
  return {
    key: "p_site_id",
    value: "site-123",
    ...overrides,
  };
}

export function makeFilterItemConfig(
  overrides?: Partial<FilterItemConfig>,
): FilterItemConfig {
  return {
    column: "status",
    label: "Status",
    ...overrides,
  };
}

export function makeFilterConfig(
  overrides?: Partial<FilterConfig>,
): FilterConfig {
  return {
    enabled: true,
    items: [makeFilterItemConfig()],
    ...overrides,
  };
}

export function makeTableColumn(
  overrides?: Partial<TableColumn>,
): TableColumn {
  return {
    key: "name",
    label: "Name",
    type: "text",
    ...overrides,
  };
}
