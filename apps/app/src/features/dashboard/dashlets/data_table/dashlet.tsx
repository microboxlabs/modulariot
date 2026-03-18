"use client";

import { useMemo, useCallback } from "react";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import { compileTemplates, resolveTemplate } from "@/features/dashboard/dashlets/common/use-handlebars-templates";
import type { DashletComponentProps, DashletLayoutDefaults } from "@/features/dashboard/dashlets/types";
import { renderCell } from "@/features/dashboard/dashlets/common/cell-renderers";
import { Pill } from "@/features/dashboard/dashlets/common/pill";
import { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
import { FilterPillRow } from "@/features/dashboard/dashlets/common/filter-pill-row";
import { usePgrestRows } from "@/features/dashboard/dashlets/common/use-pgrest-rows";
import { useFilterAndSort } from "@/features/dashboard/dashlets/common/use-filter-and-sort";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Configuration Types
// ============================================================================

export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export interface TableColumn {
  key: string;
  label: string;
  type: string;
}

export interface FilterItemConfig {
  /** Column key whose distinct values are used as filter pills */
  column: string;
  /** Label shown before the filter pills, e.g. "Estado:" */
  label: string;
}

export interface FilterConfig {
  enabled: boolean;
  items: FilterItemConfig[];
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
}

export interface PgrestParam {
  key: string;
  value: string;
}

export type PgrestHttpMethod = "POST" | "GET";

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  dataMode: "static" | "pgrest";
  columns: TableColumn[];
  rows: Record<string, string>[];
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  filter: FilterConfig;
  sort: SortConfig;
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

export { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";

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
  } = config;
  const filter = useMemo(() => normalizeFilterConfig(config.filter, defaultFilter), [config.filter]);

  // ── PGREST data fetching ────────────────────────────────────────────────────
  const pgrestParamsStable = useMemo(() => pgrestParams, [pgrestParams]);
  const { rows: pgrestRows, loading, fetchError } = usePgrestRows(
    dataMode, pgrestFunctionName, pgrestHttpMethod, pgrestParamsStable,
  );

  const allRows = dataMode === "pgrest" ? pgrestRows : staticRows;

  // ── Filter & sort ─────────────────────────────────────────────────────────
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
  const compiledKeys = useMemo(
    () => compileTemplates(columns.map((c) => ({ id: c.key, template: c.key }))),
    [columns]
  );

  const compiledLabels = useMemo(
    () => compileTemplates(columns.map((c) => ({ id: c.key, template: c.label }))),
    [columns]
  );

  const compiledTypes = useMemo(
    () => compileTemplates(columns.map((c) => ({ id: c.key, template: c.type }))),
    [columns]
  );

  const resolveCellValue = useCallback(
    (
      row: Record<string, string>,
      col: TableColumn,
      rowIdx: number,
      totalRows: number
    ): string =>
      resolveTemplate(compiledKeys, col.key, { row, ...row, _index: rowIdx, _count: totalRows }, col.key),
    [compiledKeys]
  );

  const resolveHeaderLabel = useCallback(
    (col: TableColumn): string =>
      resolveTemplate(compiledLabels, col.key, { _count: displayRows.length }, col.label),
    [compiledLabels, displayRows.length]
  );

  const resolveCellType = useCallback(
    (
      row: Record<string, string>,
      col: TableColumn,
      rowIdx: number,
      totalRows: number
    ): string => {
      const result = resolveTemplate(
        compiledTypes, col.key,
        { row, ...row, _index: rowIdx, _count: totalRows },
        col.type || "text"
      );
      return result.trim() || "text";
    },
    [compiledTypes]
  );

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
                    {resolveHeaderLabel(col)}
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
                displayRows.map((row, rowIdx) => (
                  <tr
                    key={row.id ?? row._id ?? rowIdx}
                    className="border-t border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-4 text-gray-700 dark:text-gray-300"
                      >
                        {renderCell(
                          resolveCellValue(row, col, rowIdx, displayRows.length),
                          resolveCellType(row, col, rowIdx, displayRows.length)
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
