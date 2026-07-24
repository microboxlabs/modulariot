// Internal test builders — not exported from any entry, never ships in dist.
// If the "/testing" subpath (mock providers + fixtures) gets green-lit, this
// file becomes its seed.
import type { PgrestParam } from "./core/pgrest-types";
import type { FilterItemConfig, FilterConfig } from "./core/filter-types";
import type { TableColumn } from "./core/column-types";

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
