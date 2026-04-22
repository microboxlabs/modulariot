"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import type {
  DashletComponentProps,
  DashletLayoutDefaults,
} from "@/features/dashboard/dashlets/types";
import type {
  TableColumn,
  SortConfig,
} from "@/features/dashboard/dashlets/common/column-types";
import type {
  FilterItemConfig,
  FilterConfig,
} from "@/features/dashboard/dashlets/common/filter-types";
import { renderCell } from "@/features/dashboard/dashlets/common/cell-renderers";
import { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
import { FilterPillRow } from "@/features/dashboard/dashlets/common/filter-pill-row";
import { SortPillRow } from "@/features/dashboard/dashlets/common/sort-pill-row";
import { useFilterAndSort } from "@/features/dashboard/dashlets/common/use-filter-and-sort";
import { useColumnFilters } from "@/features/dashboard/dashlets/common/use-column-filters";
import { ColumnFilterPopover } from "@/features/dashboard/dashlets/common/column-filter-popover";
import { ColumnFilterToolbar } from "@/features/dashboard/dashlets/common/column-filter-toolbar";
import { useDashletData } from "@/features/dashboard/dashlets/common/use-dashlet-data";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { useCompiledColumns } from "@/features/dashboard/dashlets/common/use-compiled-columns";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Re-exports
// ============================================================================

export type {
  ColumnType,
  DataType,
  TableColumn,
  SortConfig,
} from "@/features/dashboard/dashlets/common/column-types";
export type {
  FilterItemConfig,
  FilterConfig,
} from "@/features/dashboard/dashlets/common/filter-types";
export type {
  PgrestParam,
  PgrestHttpMethod,
} from "@/features/dashboard/dashlets/common/pgrest-types";
export { normalizeFilterConfig } from "@/features/dashboard/dashlets/common/filter-helpers";
export { resolveDataProperty } from "@/features/dashboard/dashlets/common/handlebars-helpers";

import type {
  PgrestParam,
  PgrestHttpMethod,
} from "@/features/dashboard/dashlets/common/pgrest-types";
import type { ColorRulesConfig } from "@/features/dashboard/dashlets/common/color-rule-types";
import {
  findMatchingColor,
  getRowColorClasses,
} from "@/features/dashboard/dashlets/common/color-rule-engine";
import { normalizeColorRulesConfig } from "@/features/dashboard/dashlets/common/color-rule-helpers";
import type { ActionsConfig } from "@/features/dashboard/dashlets/common/action-types";
import {
  normalizeActionsConfig,
  isSafeActionUrl,
} from "@/features/dashboard/dashlets/common/action-helpers";
import { resolveHandlebarsField } from "@/features/dashboard/dashlets/common/use-handlebars-templates";
import { ActionDropdown } from "@/features/dashboard/dashlets/common/action-dropdown";
import {
  DashletTitleBar,
  buildTitleBarData,
} from "@/features/dashboard/dashlets/common/dashlet-title-bar";

// ============================================================================
// Sticky column helpers
// ============================================================================

function measureLeftOffsets(
  columns: TableColumn[],
  cells: HTMLCollection
): Record<number, number> {
  const offsets: Record<number, number> = {};
  let left = 0;
  for (let i = 0; i < columns.length; i++) {
    if (!columns[i].sticky) break;
    offsets[i] = left;
    const cell = cells[i] as HTMLElement | undefined;
    if (cell) left += cell.offsetWidth;
  }
  return offsets;
}

function measureRightOffsets(
  columns: TableColumn[],
  cells: HTMLCollection,
  leftOff: Record<number, number>,
  actionsWidth: number
): Record<number, number> {
  const offsets: Record<number, number> = {};
  let right = actionsWidth;
  for (let i = columns.length - 1; i >= 0; i--) {
    if (!columns[i].sticky) break;
    if (leftOff[i] !== undefined) break;
    offsets[i] = right;
    const cell = cells[i] as HTMLElement | undefined;
    if (cell) right += cell.offsetWidth;
  }
  return offsets;
}

function buildStickyThClass(
  colIdx: number,
  lastStickyIdx: number,
  firstStickyRightIdx: number
): string {
  const base =
    "sticky top-0 whitespace-nowrap bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-700 dark:text-gray-400";
  if (colIdx <= lastStickyIdx) {
    const shadow =
      colIdx === lastStickyIdx
        ? " shadow-[inset_-1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_-1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} left-0 z-30${shadow}`;
  }
  if (firstStickyRightIdx >= 0 && colIdx >= firstStickyRightIdx) {
    const shadow =
      colIdx === firstStickyRightIdx
        ? " shadow-[inset_1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} right-0 z-30${shadow}`;
  }
  return base;
}

function buildStickyTdClass(
  colIdx: number,
  lastStickyIdx: number,
  firstStickyRightIdx: number,
  showColumnDividers: boolean,
  columnsLength: number,
  rowBgClass: string
): string {
  const divider =
    showColumnDividers && colIdx < columnsLength - 1
      ? " relative after:absolute after:right-0 after:top-3 after:bottom-3 after:w-px after:bg-gray-200/30 dark:after:bg-gray-600/25"
      : "";
  const rowBorder = "border-t border-gray-200 dark:border-gray-600";
  const base = `${rowBorder} px-4 py-4 text-gray-700 dark:text-gray-300${divider}`;
  if (colIdx <= lastStickyIdx) {
    const shadow =
      colIdx === lastStickyIdx
        ? " shadow-[inset_-1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_-1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} sticky left-0 z-10 ${rowBgClass}${shadow}`;
  }
  if (firstStickyRightIdx >= 0 && colIdx >= firstStickyRightIdx) {
    const shadow =
      colIdx === firstStickyRightIdx
        ? " shadow-[inset_1px_0_0_theme(colors.gray.300)] dark:shadow-[inset_1px_0_0_theme(colors.gray.600)]"
        : "";
    return `${base} sticky right-0 z-10 ${rowBgClass}${shadow}`;
  }
  return base;
}

function buildStickyStyle(
  colIdx: number,
  leftOffsets: Record<number, number>,
  rightOffsets: Record<number, number>,
  lastStickyIdx: number,
  firstStickyRightIdx: number
): React.CSSProperties | undefined {
  if (colIdx <= lastStickyIdx && leftOffsets[colIdx] !== undefined) {
    const style: React.CSSProperties = { left: leftOffsets[colIdx] };
    if (colIdx < lastStickyIdx) {
      style.paddingRight = "calc(1rem + 0.1px)";
    }
    return style;
  }
  if (
    firstStickyRightIdx >= 0 &&
    colIdx >= firstStickyRightIdx &&
    rightOffsets[colIdx] !== undefined
  ) {
    const style: React.CSSProperties = { right: rightOffsets[colIdx] };
    if (colIdx > firstStickyRightIdx) {
      style.paddingLeft = "calc(1rem + 0.1px)";
    }
    return style;
  }
  return undefined;
}

// ============================================================================
// Config & Defaults
// ============================================================================

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  /** Show dim vertical dividers between table columns */
  showColumnDividers?: boolean;
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
  actions?: ActionsConfig;
  /** Show the export dropdown in the title bar */
  showExport?: boolean;
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
  showColumnDividers: true,
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
  minW: 7,
  minH: 6,
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
    showColumnDividers = defaultConfig.showColumnDividers,
    dataMode = defaultConfig.dataMode,
    columns = defaultColumns,
    rows: staticRows = defaultRows,
    pgrestFunctionName = "",
    pgrestParams = [],
    pgrestHttpMethod = "POST",
    sort = defaultSort,
    dataSourceId,
    plannerVariableName,
    showExport = true,
  } = config;
  const filter = useMemo(
    () => normalizeFilterConfig(config.filter, defaultFilter),
    [config.filter]
  );
  const safeRowColorRules = useMemo(
    () =>
      normalizeColorRulesConfig(config.rowColorRules, {
        enabled: false,
        rules: [],
      }),
    [config.rowColorRules]
  );
  const safeActions = useMemo(
    () => normalizeActionsConfig(config.actions, { enabled: false, items: [] }),
    [config.actions]
  );
  const hasActions = safeActions.enabled && safeActions.items.length > 0;

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

  const allRows =
    dataMode === "pgrest" || dataMode === "planner" ? fetchedRows : staticRows;

  // ── Legacy filter & sort (pill-based) ────────────────────────────────────
  const {
    filterValues,
    sortKey,
    sortDir,
    filterOptionsByColumn,
    displayRows: legacyDisplayRows,
    validSortColumns,
    getColumnLabel,
    handleFilterClear,
    handleFilterSelect,
    handleSortClick,
  } = useFilterAndSort(filter, sort, allRows, columns);

  // ── Per-column filters ─────────────────────────────────────────────────────
  const {
    filters: columnFilters,
    filteredData: displayRows,
    enumValues,
    resolvedDataTypes,
    setFilter: setColumnFilter,
    removeFilter: removeColumnFilter,
    clearAllFilters: clearAllColumnFilters,
    activeFilterCount,
    totalCount: columnFilterTotal,
    filteredCount: columnFilteredCount,
  } = useColumnFilters(legacyDisplayRows, columns);

  // ── Handlebars template compilation ────────────────────────────────────────
  const { resolveValue, resolveLabel, resolveType } = useCompiledColumns(
    columns,
    displayRows.length
  );

  // ── Title bar data ──────────────────────────────────────────────────────────
  const titleBarData = buildTitleBarData({
    title,
    showRowCount,
    showExport,
    columns,
    displayRows,
    resolveValue,
    resolveLabel,
    dictionary,
  });

  // ── Sticky column left offsets ──────────────────────────────────────────────
  const headerRowRef = useRef<HTMLTableRowElement>(null);
  const [stickyLeftOffsets, setStickyLeftOffsets] = useState<
    Record<number, number>
  >({});
  const [stickyRightOffsets, setStickyRightOffsets] = useState<
    Record<number, number>
  >({});

  const measureStickyOffsets = useCallback(() => {
    const row = headerRowRef.current;
    if (!row) return;
    const cells = row.children;

    const leftOff = measureLeftOffsets(columns, cells);
    setStickyLeftOffsets(leftOff);

    // Measure actions column width (last child if actions exist)
    let actionsWidth = 0;
    if (hasActions && cells.length > columns.length) {
      const actionsCell = cells[cells.length - 1] as HTMLElement | undefined;
      if (actionsCell) actionsWidth = actionsCell.offsetWidth;
    }

    setStickyRightOffsets(
      measureRightOffsets(columns, cells, leftOff, actionsWidth)
    );
  }, [columns, hasActions]);

  useEffect(() => {
    measureStickyOffsets();

    const row = headerRowRef.current;

    // Re-measure on window resize
    window.addEventListener("resize", measureStickyOffsets);

    // Re-measure when header row cells change size (e.g. content reflow)
    let observer: ResizeObserver | undefined;
    if (row) {
      observer = new ResizeObserver(measureStickyOffsets);
      observer.observe(row);
    }

    // Re-measure after fonts finish loading (can shift column widths)
    document.fonts?.ready.then(measureStickyOffsets);

    return () => {
      window.removeEventListener("resize", measureStickyOffsets);
      observer?.disconnect();
    };
  }, [measureStickyOffsets, displayRows]);

  const lastStickyIdx = useMemo(() => {
    let last = -1;
    for (let i = 0; i < columns.length; i++) {
      if (!columns[i].sticky) break;
      last = i;
    }
    return last;
  }, [columns]);

  const firstStickyRightIdx = useMemo(() => {
    let first = -1;
    for (let i = columns.length - 1; i >= 0; i--) {
      if (!columns[i].sticky) break;
      // Don't double-count left-sticky columns
      if (i <= lastStickyIdx) break;
      first = i;
    }
    return first;
  }, [columns, lastStickyIdx]);

  // ── Render ──────────────────────────────────────────────────────────────────
  const allLabel = tr("common.all", dictionary);

  return (
    <div className="flex h-full flex-col gap-3">
      <DashletTitleBar
        {...titleBarData}
        rowCountLabel={tr(
          displayRows.length === 1
            ? "dashboard.settings.totalItemsSingular"
            : "dashboard.settings.totalItems",
          dictionary,
          { count: String(displayRows.length) }
        )}
      />

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
      {sort.enabled && (
        <SortPillRow
          label={tr("dashboard.settings.sortBy", dictionary)}
          columns={validSortColumns}
          sortKey={sortKey}
          sortDir={sortDir}
          getColumnLabel={getColumnLabel}
          onSortClick={handleSortClick}
        />
      )}

      {/* Per-column filter toolbar */}
      {activeFilterCount > 0 && (
        <ColumnFilterToolbar
          filters={columnFilters}
          columns={columns}
          totalCount={columnFilterTotal}
          filteredCount={columnFilteredCount}
          onRemove={removeColumnFilter}
          onClearAll={clearAllColumnFilters}
        />
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
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20">
              <tr ref={headerRowRef} className="bg-gray-50 dark:bg-gray-700">
                {columns.map((col, colIdx) => (
                  <th
                    key={col.key}
                    className={buildStickyThClass(
                      colIdx,
                      lastStickyIdx,
                      firstStickyRightIdx
                    )}
                    style={buildStickyStyle(
                      colIdx,
                      stickyLeftOffsets,
                      stickyRightOffsets,
                      lastStickyIdx,
                      firstStickyRightIdx
                    )}
                  >
                    <div className="flex items-center gap-1">
                      <span>{resolveLabel(col.key)}</span>
                      <ColumnFilterPopover
                        columnKey={col.key}
                        columnLabel={resolveLabel(col.key)}
                        dataType={resolvedDataTypes[col.key] ?? "text"}
                        currentFilter={columnFilters[col.key]}
                        enumValues={enumValues[col.key] ?? []}
                        onFilterChange={setColumnFilter}
                      />
                    </div>
                  </th>
                ))}
                {hasActions && (
                  <th
                    className={`sticky right-0 z-30 w-10 bg-gray-50 px-2 py-3 dark:bg-gray-700 ${firstStickyRightIdx < 0 ? "border-l border-gray-200 dark:border-gray-600" : ""}`}
                  >
                    <span className="sr-only">
                      {tr("dashboard.settings.actions", dictionary)}
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={(columns.length || 1) + (hasActions ? 1 : 0)}
                    className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500"
                  >
                    No data
                  </td>
                </tr>
              ) : (
                displayRows.map((row, rowIdx) => {
                  const rowColor = safeRowColorRules.enabled
                    ? findMatchingColor(
                        safeRowColorRules.rules,
                        row,
                        resolveValue,
                        rowIdx,
                        displayRows.length
                      )
                    : null;
                  const rowBgClass = rowColor
                    ? getRowColorClasses(rowColor)
                    : "bg-white dark:bg-gray-800";
                  const trClass = rowBgClass;

                  return (
                    <tr key={row.id ?? row._id ?? rowIdx} className={trClass}>
                      {columns.map((col, colIdx) => (
                        <td
                          key={col.key}
                          className={buildStickyTdClass(
                            colIdx,
                            lastStickyIdx,
                            firstStickyRightIdx,
                            showColumnDividers ?? true,
                            columns.length,
                            rowBgClass
                          )}
                          style={buildStickyStyle(
                            colIdx,
                            stickyLeftOffsets,
                            stickyRightOffsets,
                            lastStickyIdx,
                            firstStickyRightIdx
                          )}
                        >
                          {renderCell(
                            resolveValue(
                              col.key,
                              row,
                              rowIdx,
                              displayRows.length
                            ),
                            resolveType(
                              col.key,
                              row,
                              rowIdx,
                              displayRows.length
                            ),
                            col.colorMap
                          )}
                        </td>
                      ))}
                      {hasActions && (
                        <td
                          className={`sticky right-0 border-t border-gray-200 px-2 py-4 dark:border-gray-600 ${firstStickyRightIdx < 0 ? "border-l" : ""} ${rowBgClass}`}
                        >
                          <ActionDropdown
                            items={safeActions.items
                              .map((action) => {
                                const ctx = { ...row, row };
                                const href = resolveHandlebarsField(
                                  action.link,
                                  ctx
                                );
                                return isSafeActionUrl(href)
                                  ? { action, href }
                                  : null;
                              })
                              .filter(
                                (item): item is NonNullable<typeof item> =>
                                  item !== null
                              )}
                            ariaLabel={tr(
                              "dashboard.settings.moreActions",
                              dictionary
                            )}
                          />
                        </td>
                      )}
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
