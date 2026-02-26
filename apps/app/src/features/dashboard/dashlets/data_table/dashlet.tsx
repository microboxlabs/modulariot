"use client";

import { useState, useMemo } from "react";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "@/features/dashboard/dashlets/types";
import type { TableColumn, SortConfig } from "@/features/dashboard/dashlets/common/column-types";
import { renderCell } from "@/features/dashboard/dashlets/common/cell-renderers";
import { Pill } from "@/features/dashboard/dashlets/common/pill";
import { useDynamicRows } from "@/features/dashboard/dashlets/common/use-dynamic-rows";
import { useDashboard } from "@/features/dashboard/context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

export type { ColumnType, TableColumn, SortConfig } from "@/features/dashboard/dashlets/common/column-types";

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

export interface DashletConfig {
  title: string;
  showRowCount: boolean;
  dataMode: "static" | "dynamic";
  columns: TableColumn[];
  rows: Record<string, string>[];
  apiUrl: string;
  filter: FilterConfig;
  sort: SortConfig;
}

// ============================================================================
// Defaults
// ============================================================================

export const defaultColumns: TableColumn[] = [
  { key: "vehicle", label: "Vehículo", type: "text" },
  { key: "client", label: "Cliente", type: "text" },
  { key: "km", label: "KM Totales", type: "highlight" },
  { key: "system", label: "Sistema", type: "text" },
  { key: "status", label: "Estado", type: "badge" },
  { key: "alert", label: "Tipo de Alerta", type: "text" },
  { key: "duration", label: "Duración", type: "text" },
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
  items: [{ column: "status", label: "Estado:" }],
};

/**
 * Normalize a persisted filter config into the current shape.
 * Old configs stored `{ enabled, column, label }` — convert to `{ enabled, items }`.
 */
export function normalizeFilterConfig(raw: unknown): FilterConfig {
  if (!raw || typeof raw !== "object") return defaultFilter;
  const obj = raw as Record<string, unknown>;
  const enabled = typeof obj.enabled === "boolean" ? obj.enabled : defaultFilter.enabled;
  if (Array.isArray(obj.items)) {
    const validItems = obj.items.filter(
      (item): item is FilterItemConfig =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).column === "string" &&
        (item as Record<string, unknown>).column !== ""
    ).map((item) => ({
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
      items: [{ column: obj.column, label: typeof obj.label === "string" ? obj.label : "" }],
    };
  }
  return defaultFilter;
}

export const defaultSort: SortConfig = {
  enabled: true,
  columns: ["status", "system", "duration"],
};

export const defaultConfig: DashletConfig = {
  title: "Data Table",
  showRowCount: true,
  dataMode: "static",
  columns: defaultColumns,
  rows: defaultRows,
  apiUrl: "",
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
  } = config;
  const filter = useMemo(() => normalizeFilterConfig(config.filter), [config.filter]);

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
    dir === "asc" ? <HiArrowUp className="h-3 w-3" /> : <HiArrowDown className="h-3 w-3" />;

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
      {/* Title + row count — outside any card */}
      <div className="flex shrink-0 items-start justify-between">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          {title}
        </h3>
        {showRowCount && (
          <span className="shrink-0 text-sm text-gray-500 dark:text-gray-400">
            {displayRows.length}{" "}
            {displayRows.length === 1 ? "item" : "items"} en total
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
            Ordenar por:
          </span>
          {sort.columns.map((key) => (
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
                    {col.label}
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
                displayRows.map((row) => (
                  <tr
                    key={columns.map((col) => row[col.key] ?? "").join("|")}
                    className="border-t border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="px-4 py-4 text-gray-700 dark:text-gray-300"
                      >
                        {renderCell(row[col.key] ?? "", col.type)}
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
