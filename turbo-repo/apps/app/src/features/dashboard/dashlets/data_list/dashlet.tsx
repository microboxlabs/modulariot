"use client";

import { useMemo } from "react";
import { HiEllipsisVertical } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import type {
  BadgeColorMapping,
  DataMode,
  TableColumn,
  SortConfig,
} from "../common/column-types";
import type { FilterConfig, FilterItemConfig } from "../common/filter-types";
import type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
import { renderCell } from "../common/cell-renderers";
import { useDynamicRows } from "../common/use-dynamic-rows";
import { useDashletData } from "../common/use-dashlet-data";
import { useEffectiveRefreshInterval } from "../../hooks/use-effective-refresh-interval";
import { normalizeFilterConfig } from "../common/filter-helpers";
import { FilterPillRow } from "../common/filter-pill-row";
import { SortPillRow } from "../common/sort-pill-row";
import { useFilterAndSort } from "../common/use-filter-and-sort";
import { useCompiledColumns } from "../common/use-compiled-columns";
import {
  DashletTitleBar,
  buildTitleBarData,
} from "../common/dashlet-title-bar";

export type {
  DataMode,
  ColumnType,
  TableColumn,
  SortConfig,
} from "../common/column-types";
export type { FilterItemConfig, FilterConfig } from "../common/filter-types";
export type { PgrestParam, PgrestHttpMethod } from "../common/pgrest-types";
export { normalizeFilterConfig } from "../common/filter-helpers";

// ============================================================================
// Configuration Types
// ============================================================================

export interface CardLayoutConfig {
  /** Column key for the primary title (e.g. vehicle ID) */
  titleColumn: string;
  /** Column key for the subtitle line */
  subtitleColumn: string;
  /** Column keys rendered as badges next to the title */
  headerBadgeColumns: string[];
  /** Column keys shown as a KPI grid in the card body */
  kpiColumns: string[];
  /** Column keys shown in the footer row */
  footerColumns: string[];
}

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  dataMode: DataMode;
  columns: TableColumn[];
  rows: Record<string, string>[];
  apiUrl: string;
  pgrestFunctionName: string;
  pgrestParams: PgrestParam[];
  pgrestHttpMethod: PgrestHttpMethod;
  dataSourceId?: string;
  filter: FilterConfig;
  sort: SortConfig;
  cardLayout: CardLayoutConfig;
  plannerVariableName?: string;
  /** Show the export dropdown in the title bar */
  showExport?: boolean;
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultColumns: TableColumn[] = [
  { key: "{{row.vehicleId}}", label: "ID Vehículo", type: "text" },
  { key: "{{row.vehicleDesc}}", label: "Descripción", type: "text" },
  { key: "{{row.exposure}}", label: "Exposición", type: "badge" },
  { key: "{{row.km}}", label: "Km Totales", type: "highlight" },
  { key: "{{row.events}}", label: "Total eventos", type: "text" },
  { key: "{{row.speed}}", label: "Velocidad", type: "text" },
  { key: "{{row.signal}}", label: "Señal", type: "text" },
  { key: "{{row.schedule}}", label: "Horario", type: "text" },
  { key: "{{row.stops}}", label: "Detenciones", type: "text" },
  { key: "{{row.lastDetection}}", label: "Última detección", type: "text" },
  { key: "{{row.severity}}", label: "Severidad predominante", type: "badge" },
];

export const defaultRows: Record<string, string>[] = [
  {
    vehicleId: "FL-2341",
    vehicleDesc: "Peugeot Partner · Traza Logistics",
    exposure: "Exposición Crítica",
    km: "47,400 km",
    events: "24",
    speed: "15",
    signal: "3",
    schedule: "4",
    stops: "2",
    lastDetection: "Hace 15 min",
    severity: "Crítico",
  },
  {
    vehicleId: "FL-1892",
    vehicleDesc: "Mercedes Vito · Logística Express",
    exposure: "Exposición Crítica",
    km: "38,900 km",
    events: "18",
    speed: "12",
    signal: "5",
    schedule: "3",
    stops: "4",
    lastDetection: "Hace 30 min",
    severity: "Crítico",
  },
  {
    vehicleId: "FL-3456",
    vehicleDesc: "Mitsubishi L200 · Constructora Andina S.A.",
    exposure: "Exposición Media",
    km: "61,200 km",
    events: "10",
    speed: "8",
    signal: "2",
    schedule: "6",
    stops: "1",
    lastDetection: "Hace 1 hora",
    severity: "Medio",
  },
  {
    vehicleId: "FL-4521",
    vehicleDesc: "Volkswagen Amarok · Distribuciones FastGo",
    exposure: "Exposición Baja",
    km: "23,400 km",
    events: "5",
    speed: "3",
    signal: "1",
    schedule: "2",
    stops: "0",
    lastDetection: "Hace 2 horas",
    severity: "Bajo",
  },
];

export const defaultFilter: FilterConfig = {
  enabled: true,
  items: [{ column: "{{row.exposure}}", label: "Exposición:" }],
};

export const defaultSort: SortConfig = {
  enabled: true,
  columns: ["{{row.exposure}}", "{{row.km}}", "{{row.events}}"],
};

export const defaultCardLayout: CardLayoutConfig = {
  titleColumn: "{{row.vehicleId}}",
  subtitleColumn: "{{row.vehicleDesc}}",
  headerBadgeColumns: ["{{row.exposure}}"],
  kpiColumns: [
    "{{row.km}}",
    "{{row.events}}",
    "{{row.speed}}",
    "{{row.signal}}",
    "{{row.schedule}}",
    "{{row.stops}}",
  ],
  footerColumns: ["{{row.lastDetection}}", "{{row.severity}}"],
};

export const defaultConfig: DashletConfig = {
  title: "Data List",
  showRowCount: true,
  dataMode: "static",
  columns: defaultColumns,
  rows: defaultRows,
  apiUrl: "",
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
  filter: defaultFilter,
  sort: defaultSort,
  cardLayout: defaultCardLayout,
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
// List Card
// ============================================================================

interface ListCardProps {
  row: Record<string, string>;
  rowIdx: number;
  totalRows: number;
  columns: TableColumn[];
  cardLayout: CardLayoutConfig;
  resolveValue: (
    key: string,
    row: Record<string, string>,
    rowIdx: number,
    totalRows: number
  ) => string;
  resolveLabel: (key: string) => string;
  resolveType: (
    key: string,
    row: Record<string, string>,
    rowIdx: number,
    totalRows: number
  ) => string;
}

function ListCard({
  row,
  rowIdx,
  totalRows,
  columns,
  cardLayout,
  resolveValue,
  resolveLabel,
  resolveType,
}: Readonly<ListCardProps>) {
  function resolveColorMap(key: string): BadgeColorMapping[] | undefined {
    const col = columns.find((c) => c.key === key);
    return col?.colorMap;
  }

  const titleValue = resolveValue(
    cardLayout.titleColumn,
    row,
    rowIdx,
    totalRows
  );
  const subtitleValue = resolveValue(
    cardLayout.subtitleColumn,
    row,
    rowIdx,
    totalRows
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      {/* Header: title + badges + menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-gray-900 dark:text-white">
              {titleValue}
            </span>
            {cardLayout.headerBadgeColumns.map((key) => {
              const val = resolveValue(key, row, rowIdx, totalRows);
              if (!val) return null;
              const colType = resolveType(key, row, rowIdx, totalRows);
              return (
                <span key={key}>
                  {renderCell(val, colType || "badge", resolveColorMap(key))}
                </span>
              );
            })}
          </div>
          {subtitleValue && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {subtitleValue}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="no-drag shrink-0 cursor-pointer rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <HiEllipsisVertical className="h-5 w-5" />
        </button>
      </div>

      {/* KPI Grid */}
      {cardLayout.kpiColumns.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-6">
          {cardLayout.kpiColumns.map((key) => {
            const val = resolveValue(key, row, rowIdx, totalRows);
            const colType = resolveType(key, row, rowIdx, totalRows);
            return (
              <div key={key} className="min-w-0">
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {resolveLabel(key)}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {renderCell(val, colType || "text", resolveColorMap(key))}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer metadata */}
      {cardLayout.footerColumns.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3 dark:border-gray-700">
          {cardLayout.footerColumns.map((key) => {
            const val = resolveValue(key, row, rowIdx, totalRows);
            const colType = resolveType(key, row, rowIdx, totalRows);
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
              >
                <span>{resolveLabel(key)}:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {renderCell(val, colType || "text", resolveColorMap(key))}
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
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
    apiUrl = "",
    pgrestFunctionName = "",
    pgrestParams = [],
    pgrestHttpMethod = "POST",
    sort = defaultSort,
    cardLayout = defaultCardLayout,
    plannerVariableName,
    showExport = true,
  } = config;
  const filter = useMemo(
    () => normalizeFilterConfig(config.filter, defaultFilter),
    [config.filter]
  );

  // ── Dynamic data fetching ───────────────────────────────────────────────────
  const {
    rows: dynamicRows,
    loading: dynamicLoading,
    fetchError: dynamicError,
  } = useDynamicRows(dataMode, apiUrl);

  // ── PGREST / Planner data fetching ──────────────────────────────────────────
  const refreshIntervalMs = useEffectiveRefreshInterval(widget.config);
  const pgrestParamsStable = useMemo(() => pgrestParams, [pgrestParams]);
  const {
    rows: fetchedRows,
    loading: fetchedLoading,
    fetchError: fetchedError,
  } = useDashletData({
    dataMode,
    pgrestFunctionName,
    pgrestHttpMethod,
    pgrestParams: pgrestParamsStable,
    plannerVariableName,
    dataSourceId: config.dataSourceId,
    refreshIntervalMs,
  });

  const loading = dynamicLoading || fetchedLoading;
  const fetchError = dynamicError || fetchedError;
  let allRows: typeof staticRows;
  if (dataMode === "pgrest" || dataMode === "planner") {
    allRows = fetchedRows;
  } else if (dataMode === "dynamic") {
    allRows = dynamicRows;
  } else {
    allRows = staticRows;
  }

  // ── Filter & sort (shared hook) ───────────────────────────────────────────
  const {
    filterValues,
    sortKey,
    sortDir,
    filterOptionsByColumn,
    displayRows,
    getColumnLabel,
    handleFilterClear,
    handleFilterSelect,
    handleSortClick,
  } = useFilterAndSort(filter, sort, allRows, columns);

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

  // ── Render ──────────────────────────────────────────────────────────────────
  const allLabel = tr("common.all", dictionary);

  return (
    <div className="flex h-full flex-col gap-3">
      <DashletTitleBar
        {...titleBarData}
        rowCountLabel={
          displayRows.length === 1
            ? tr("dashboard.dashlets.data_list.itemTotal", dictionary)
            : tr("dashboard.dashlets.data_list.itemsTotal", dictionary, {
                count: String(displayRows.length),
              })
        }
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
          label={tr("dashboard.dashlets.data_list.sortBy", dictionary)}
          columns={sort.columns}
          sortKey={sortKey}
          sortDir={sortDir}
          getColumnLabel={getColumnLabel}
          onSortClick={handleSortClick}
        />
      )}

      {/* Cards list */}
      <div className="flex-1 space-y-3 overflow-auto">
        {loading && (
          <div className="flex h-20 items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            {tr("dashboard.dashlets.data_list.loading", dictionary)}
          </div>
        )}
        {fetchError && (
          <div className="flex h-20 items-center justify-center text-sm text-red-500 dark:text-red-400">
            {tr("dashboard.dashlets.data_list.error", dictionary, {
              message: fetchError ?? "",
            })}
          </div>
        )}
        {!loading && !fetchError && displayRows.length === 0 && (
          <div className="flex h-20 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            {tr("dashboard.dashlets.data_list.noData", dictionary)}
          </div>
        )}
        {!loading &&
          !fetchError &&
          displayRows.map((row, idx) => {
            const titleKey = resolveValue(
              cardLayout.titleColumn,
              row,
              idx,
              displayRows.length
            );
            return (
              <ListCard
                key={titleKey ? `${titleKey}-${idx}` : `row-${idx}`}
                row={row}
                rowIdx={idx}
                totalRows={displayRows.length}
                columns={columns}
                cardLayout={cardLayout}
                resolveValue={resolveValue}
                resolveLabel={resolveLabel}
                resolveType={resolveType}
              />
            );
          })}
      </div>
    </div>
  );
}
