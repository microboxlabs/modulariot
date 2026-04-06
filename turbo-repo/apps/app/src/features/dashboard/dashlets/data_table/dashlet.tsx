"use client";

import { useMemo } from "react";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "@/features/dashboard/dashlets/types";
import type { TableColumn, SortConfig } from "@/features/dashboard/dashlets/common/column-types";
import type { FilterItemConfig, FilterConfig } from "@/features/dashboard/dashlets/common/filter-types";
import { renderCell } from "@/features/dashboard/dashlets/common/cell-renderers";
import { Pill } from "@/features/dashboard/dashlets/common/pill";
import { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
import { FilterPillRow } from "@/features/dashboard/dashlets/common/filter-pill-row";
import { useFilterAndSort } from "@/features/dashboard/dashlets/common/use-filter-and-sort";
import { useDashletData } from "@/features/dashboard/dashlets/common/use-dashlet-data";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useCompiledColumns } from "@/features/dashboard/dashlets/common/use-compiled-columns";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Re-exports
// ============================================================================

export type { ColumnType, TableColumn, SortConfig } from "@/features/dashboard/dashlets/common/column-types";
export type { FilterItemConfig, FilterConfig } from "@/features/dashboard/dashlets/common/filter-types";
export type { PgrestParam, PgrestHttpMethod } from "@/features/dashboard/dashlets/common/pgrest-types";
export { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
export { resolveDataProperty } from "@/features/dashboard/dashlets/common/handlebars-helpers";

import type { PgrestParam, PgrestHttpMethod } from "@/features/dashboard/dashlets/common/pgrest-types";
import type { ColorRulesConfig } from "@/features/dashboard/dashlets/common/color-rule-types";
import { findMatchingColor, getRowColorClasses } from "@/features/dashboard/dashlets/common/color-rule-engine";

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  dataMode: "static" | "pgrest" | "planner";
  columns: TableColumn[];
  rows: Record<string, string>[];
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  filter: FilterConfig;
  sort: SortConfig;
  dataSourceId?: string;
  plannerVariableName?: string;
  rowColorRules?: ColorRulesConfig;
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultColumns: TableColumn[] = [
  { key: "{{row.vehicle}}", label: "Vehículo", type: "text" },
  { key: "{{row.client}}", label: "Cliente", type: "text" },
  { key: "{{row.km}}", label: "KM Totales", type: "highlight" },
  { key: "{{row.system}}", label: "Sistema", type: "text" },
  { key: "{{row.status}}", label: "Estado", type: "badge" },
  { key: "{{row.alert}}", label: "Tipo de Alerta", type: "text" },
  { key: "{{row.duration}}", label: "Duración", type: "text" },
];

export const defaultRows: Record<string, string>[] = [
  {
    vehicle: "FL-2341\nPeugeot Partner",
    client: "Traza Logistics",
    km: "47,400 km",
    system: "DPF",
    status: "Crítico",
    alert: "Saturación DPF crítica",
    duration: "12 días",
  },
  {
    vehicle: "FL-1892\nMercedes Vito",
    client: "Logística Express",
    km: "38,900 km",
    system: "Motor",
    status: "Crítico",
    alert: "Temperatura elevada",
    duration: "8 días",
  },
  {
    vehicle: "FL-3456\nMitsubishi L200",
    client: "Constructora Andina S.A.",
    km: "61,200 km",
    system: "DPF",
    status: "Crítico",
    alert: "Presión diferencial alta",
    duration: "5 días",
  },
  {
    vehicle: "FL-4521\nVolkswagen Amarok",
    client: "Distribuciones FastGo",
    km: "23,400 km",
    system: "Alimentación",
    status: "Medio",
    alert: "Presión de combustible baja",
    duration: "3 días",
  },
];

export const defaultFilter: FilterConfig = {
  enabled: true,
  items: [{ column: "{{row.status}}", label: "Estado:" }],
};

export const defaultSort: SortConfig = {
  enabled: true,
  columns: ["{{row.status}}", "{{row.system}}", "{{row.duration}}"],
};

export const defaultConfig: DashletConfig = {
  title: "Data Table",
  showRowCount: true,
  dataMode: "static",
  columns: defaultColumns,
  rows: defaultRows,
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
  filter: defaultFilter,
  sort: defaultSort,
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 6,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const { dictionary } = useDashboard();
  const config = widget.config as unknown as DashletConfig;
  const {
    title = defaultConfig.title,
    showRowCount = defaultConfig.showRowCount,
    dataMode = defaultConfig.dataMode,
    columns = defaultColumns,
    rows: staticRows = defaultRows,
    pgrestFunctionName = "",
    pgrestParams = [],
    pgrestHttpMethod = "POST",
    sort = defaultSort,
    dataSourceId,
    plannerVariableName,
    rowColorRules,
  } = config;
  const filter = useMemo(() => normalizeFilterConfig(config.filter, defaultFilter), [config.filter]);

  // ── Data fetching (pgrest or planner) ───────────────────────────────────────
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const {
    rows: fetchedRows,
    loading,
    fetchError,
  } = useDashletData({
    dataMode,
    pgrestFunctionName,
    pgrestHttpMethod,
    pgrestParams,
    dataSourceId,
    plannerVariableName,
    refreshIntervalMs,
  });

  const allRows = dataMode === "pgrest" || dataMode === "planner" ? fetchedRows : staticRows;

  // ── Filter & sort (shared hook) ───────────────────────────────────────────
  const {
    filterValues,
    sortKey,
    sortDir,
    filterOptionsByColumn,
    displayRows,
    validSortColumns,
    getColumnLabel,
    handleFilterClear,
    handleFilterSelect,
    handleSortClick,
  } = useFilterAndSort(filter, sort, allRows, columns);

  const getSortIcon = (dir: "asc" | "desc") =>
    dir === "asc" ? <HiArrowUp className="h-3 w-3" /> : <HiArrowDown className="h-3 w-3" />;

  // ── Handlebars template compilation ────────────────────────────────────────
  const { resolveValue, resolveLabel, resolveType } = useCompiledColumns(columns, displayRows.length);

  // ── Render ──────────────────────────────────────────────────────────────────
  const allLabel = tr("common.all", dictionary);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Title + row count — outside any card */}
      <div className="flex shrink-0 items-start justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        {showRowCount && (
          <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
            {tr(
              displayRows.length === 1
                ? "dashboard.settings.totalItemsSingular"
                : "dashboard.settings.totalItems",
              dictionary,
              { count: String(displayRows.length) }
            )}
          </span>
        )}
      </div>

      {/* Filter cards */}
      {filter.enabled &&
        filter.items.map((item: FilterItemConfig, idx: number) => {
          const options = filterOptionsByColumn[item.column];
          if (!options || options.length === 0) return null;
          return (
            <FilterPillRow
              key={`${item.column}-${idx}`}
              item={item}
              options={options}
              selected={filterValues[item.column] ?? ""}
              allLabel={allLabel}
              onClear={handleFilterClear}
              onSelect={handleFilterSelect}
            />
          );
        })}

      {/* Sort card */}
      {sort.enabled && validSortColumns.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Ordenar por:
          </span>
          {validSortColumns.map((key) => (
            <Pill
              key={key}
              label={getColumnLabel(key)}
              active={sortKey === key}
              onClick={() => handleSortClick(key)}
              icon={
                sortKey === key
                  ? getSortIcon(sortDir)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Table card */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        {loading && (
          <div className="flex h-20 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </div>
        )}
        {fetchError && (
          <div className="flex h-20 items-center justify-center text-sm text-red-500 dark:text-red-400">
            Error: {fetchError}
          </div>
        )}
        {!loading && !fetchError && (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                  >
                    {resolveLabel(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length || 1}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    No data
                  </td>
                </tr>
              ) : (
                displayRows.map((row, rowIdx) => {
                  const rowColor = rowColorRules?.enabled
                    ? findMatchingColor(rowColorRules.rules, row, resolveValue, rowIdx, displayRows.length)
                    : null;
                  const trClass = rowColor
                    ? `border-t border-gray-100 ${getRowColorClasses(rowColor)} dark:border-gray-700`
                    : "border-t border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800";

                  return (
                    <tr
                      key={row.id ?? row._id ?? rowIdx}
                      className={trClass}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="px-4 py-4 text-gray-700 dark:text-gray-300"
                        >
                          {renderCell(
                            resolveValue(col.key, row, rowIdx, displayRows.length),
                            resolveType(col.key, row, rowIdx, displayRows.length),
                            col.colorMap,
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
