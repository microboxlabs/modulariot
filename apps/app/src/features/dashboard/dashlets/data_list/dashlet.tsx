"use client";

import { useState, useMemo } from "react";
import { HiArrowUp, HiArrowDown, HiEllipsisVertical } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";
import type { ColumnType, TableColumn, SortConfig } from "../common/column-types";
import { renderCell } from "../common/cell-renderers";
import { Pill } from "../common/pill";
import { useDynamicRows } from "../common/use-dynamic-rows";

export type { ColumnType, TableColumn, SortConfig };

// ============================================================================
// Configuration Types
// ============================================================================

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
  dataMode: "static" | "dynamic";
  columns: TableColumn[];
  rows: Record<string, string>[];
  apiUrl: string;
  filter: FilterConfig;
  sort: SortConfig;
  cardLayout: CardLayoutConfig;
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultColumns: TableColumn[] = [
  { key: "vehicleId", label: "ID Vehículo", type: "text" },
  { key: "vehicleDesc", label: "Descripción", type: "text" },
  { key: "exposure", label: "Exposición", type: "badge" },
  { key: "km", label: "Km Totales", type: "highlight" },
  { key: "events", label: "Total eventos", type: "text" },
  { key: "speed", label: "Velocidad", type: "text" },
  { key: "signal", label: "Señal", type: "text" },
  { key: "schedule", label: "Horario", type: "text" },
  { key: "stops", label: "Detenciones", type: "text" },
  { key: "lastDetection", label: "Última detección", type: "text" },
  { key: "severity", label: "Severidad predominante", type: "badge" },
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
  items: [{ column: "exposure", label: "Exposición:" }],
};

/**
 * Normalize a persisted filter config into the current shape.
 * Old configs stored `{ enabled, column, label }` — convert to `{ enabled, items }`.
 */
export function normalizeFilterConfig(raw: unknown): FilterConfig {
  if (!raw || typeof raw !== "object") return defaultFilter;
  const obj = raw as Record<string, unknown>;
  const enabled =
    typeof obj.enabled === "boolean" ? obj.enabled : defaultFilter.enabled;
  if (Array.isArray(obj.items)) {
    const validItems = obj.items
      .filter(
        (item): item is FilterItemConfig =>
          !!item &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).column === "string" &&
          (item as Record<string, unknown>).column !== ""
      )
      .map((item) => ({
        column: item.column,
        label: typeof item.label === "string" ? item.label : "",
      }));
    if (validItems.length === 0) return defaultFilter;
    return { enabled, items: validItems };
  }
  // Legacy shape: { enabled, column, label }
  if (typeof obj.column === "string" && obj.column !== "") {
    return {
      enabled,
      items: [
        {
          column: obj.column,
          label: typeof obj.label === "string" ? obj.label : "",
        },
      ],
    };
  }
  return defaultFilter;
}

export const defaultSort: SortConfig = {
  enabled: true,
  columns: ["exposure", "km", "events"],
};

export const defaultCardLayout: CardLayoutConfig = {
  titleColumn: "vehicleId",
  subtitleColumn: "vehicleDesc",
  headerBadgeColumns: ["exposure"],
  kpiColumns: ["km", "events", "speed", "signal", "schedule", "stops"],
  footerColumns: ["lastDetection", "severity"],
};

export const defaultConfig: DashletConfig = {
  title: "Data List",
  showRowCount: true,
  dataMode: "static",
  columns: defaultColumns,
  rows: defaultRows,
  apiUrl: "",
  filter: defaultFilter,
  sort: defaultSort,
  cardLayout: defaultCardLayout,
};

// ============================================================================
// Layout Defaults
// ============================================================================

export const layoutDefaults: DashletLayoutDefaults = {
  minW: 4,
  minH: 4,
};

export function getLayoutDefaults(): DashletLayoutDefaults {
  return layoutDefaults;
}

// ============================================================================
// Filter Pill Row
// ============================================================================

interface FilterPillRowProps {
  item: FilterItemConfig;
  options: string[];
  selected: string;
  allLabel: string;
  onClear: (column: string) => void;
  onSelect: (column: string, value: string) => void;
}

function FilterPillRow({
  item,
  options,
  selected,
  allLabel,
  onClear,
  onSelect,
}: Readonly<FilterPillRowProps>) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {item.label}
      </span>
      <Pill
        label={allLabel}
        active={selected === ""}
        onClick={() => onClear(item.column)}
      />
      {options.map((val) => (
        <Pill
          key={val}
          label={val}
          active={selected === val}
          onClick={() => onSelect(item.column, val)}
        />
      ))}
    </div>
  );
}

// ============================================================================
// List Card
// ============================================================================

interface ListCardProps {
  row: Record<string, string>;
  columns: TableColumn[];
  cardLayout: CardLayoutConfig;
}

function ListCard({ row, columns, cardLayout }: Readonly<ListCardProps>) {
  const colMap = new Map(columns.map((c) => [c.key, c]));

  const titleValue = row[cardLayout.titleColumn] ?? "";
  const subtitleValue = row[cardLayout.subtitleColumn] ?? "";

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
              const val = row[key];
              if (!val) return null;
              const col = colMap.get(key);
              return (
                <span key={key}>
                  {renderCell(val, col?.type ?? "badge")}
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
          className="no-drag shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          <HiEllipsisVertical className="h-5 w-5" />
        </button>
      </div>

      {/* KPI Grid */}
      {cardLayout.kpiColumns.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-6">
          {cardLayout.kpiColumns.map((key) => {
            const col = colMap.get(key);
            const val = row[key] ?? "";
            return (
              <div key={key} className="min-w-0">
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {col?.label ?? key}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {renderCell(val, col?.type ?? "text")}
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
            const col = colMap.get(key);
            const val = row[key] ?? "";
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
              >
                <span>{col?.label ?? key}:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {renderCell(val, col?.type ?? "text")}
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
    sort = defaultSort,
    cardLayout = defaultCardLayout,
  } = config;
  const filter = useMemo(
    () => normalizeFilterConfig(config.filter),
    [config.filter]
  );

  // ── Dynamic data fetching ───────────────────────────────────────────────────
  const { rows: dynamicRows, loading, fetchError } = useDynamicRows(dataMode, apiUrl);

  // ── Filter & sort state ─────────────────────────────────────────────────────
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allRows = dataMode === "dynamic" ? dynamicRows : staticRows;

  // Distinct values per filter item (derived from full dataset)
  const filterOptionsByColumn = useMemo(() => {
    if (!filter.enabled) return {};
    const result: Record<string, string[]> = {};
    for (const item of filter.items) {
      const seen = new Set<string>();
      for (const row of allRows) {
        const val = row[item.column];
        if (val) seen.add(val);
      }
      result[item.column] = Array.from(seen);
    }
    return result;
  }, [allRows, filter.enabled, filter.items]);

  // Column label lookup for sort toolbar
  const getColumnLabel = (key: string) =>
    columns.find((c) => c.key === key)?.label ?? key;

  // Apply all active filters (AND) then sort
  const displayRows = useMemo(() => {
    let result = allRows;

    if (filter.enabled) {
      for (const item of filter.items) {
        const selected = filterValues[item.column];
        if (selected) {
          result = result.filter((row) => row[item.column] === selected);
        }
      }
    }

    if (sort.enabled && sortKey) {
      result = [...result].sort((a, b) => {
        const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [allRows, filter, filterValues, sort, sortKey, sortDir]);

  const getSortIcon = (dir: "asc" | "desc") =>
    dir === "asc" ? (
      <HiArrowUp className="h-3 w-3" />
    ) : (
      <HiArrowDown className="h-3 w-3" />
    );

  const handleFilterClear = (column: string) => {
    setFilterValues((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
  };

  const handleFilterSelect = (column: string, value: string) => {
    setFilterValues((prev) => ({ ...prev, [column]: value }));
  };

  const handleSortClick = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const allLabel = tr("common.all", dictionary);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Title + row count */}
      <div className="flex shrink-0 items-start justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        {showRowCount && (
          <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
            {displayRows.length === 1
              ? tr("dashboard.dashlets.data_list.itemTotal", dictionary)
              : tr("dashboard.dashlets.data_list.itemsTotal", dictionary, {
                  count: String(displayRows.length),
                })}
          </span>
        )}
      </div>

      {/* Filter cards */}
      {filter.enabled &&
        filter.items.map((item, idx) => {
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
      {sort.enabled && sort.columns.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {tr("dashboard.dashlets.data_list.sortBy", dictionary)}
          </span>
          {sort.columns.map((key) => (
            <Pill
              key={key}
              label={getColumnLabel(key)}
              active={sortKey === key}
              onClick={() => handleSortClick(key)}
              icon={sortKey === key ? getSortIcon(sortDir) : undefined}
            />
          ))}
        </div>
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
            {tr("dashboard.dashlets.data_list.error", dictionary, { message: fetchError ?? "" })}
          </div>
        )}
        {!loading && !fetchError && displayRows.length === 0 && (
          <div className="flex h-20 items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            {tr("dashboard.dashlets.data_list.noData", dictionary)}
          </div>
        )}
        {!loading &&
          !fetchError &&
          displayRows.map((row, idx) => (
            <ListCard
              key={
                row[cardLayout.titleColumn]
                  ? `${row[cardLayout.titleColumn]}-${idx}`
                  : `row-${idx}`
              }
              row={row}
              columns={columns}
              cardLayout={cardLayout}
            />
          ))}
      </div>
    </div>
  );
}
