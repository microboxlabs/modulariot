"use client";

import { useState, useEffect, useMemo } from "react";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";
import { useDashboard } from "../../context/dashboard-context";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Configuration Types
// ============================================================================

export type ColumnType = "text" | "badge" | "highlight" | "signed" | "progress";

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
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
  dataMode: "static" | "dynamic" | "pgrest";
  columns: TableColumn[];
  rows: Record<string, string>[];
  apiUrl: string;
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
  pgrestFunctionName: "",
  pgrestParams: [],
  pgrestHttpMethod: "POST",
  filter: defaultFilter,
  sort: defaultSort,
};

/** Build the fetch URL + init for PGREST or dynamic data sources. */
function buildDataFetchRequest(
  dataMode: string,
  apiUrl: string,
  pgrestFunctionName: string,
  pgrestParams: PgrestParam[],
  pgrestHttpMethod: PgrestHttpMethod
): { url: string; init?: RequestInit } | null {
  if (dataMode === "dynamic" && apiUrl) {
    return { url: apiUrl };
  }
  if (dataMode !== "pgrest" || !pgrestFunctionName) return null;

  const validParams = pgrestParams.filter((p) => p.key && p.value);
  const baseUrl = `/app/api/dashboard/pgrest/${pgrestFunctionName}`;

  if (pgrestHttpMethod === "POST") {
    const body: Record<string, string> = {};
    for (const p of validParams) body[p.key] = p.value;
    return {
      url: baseUrl,
      init: {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    };
  }

  const qs = new URLSearchParams();
  for (const p of validParams) qs.set(p.key, p.value);
  const query = qs.toString();
  return { url: query ? `${baseUrl}?${query}` : baseUrl };
}

/** Parse a dynamic API / PGREST response into a row array. */
function parseRows(data: unknown): Record<string, string>[] {
  if (Array.isArray(data)) return data as Record<string, string>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.rows ?? obj.data ?? obj.results;
    if (Array.isArray(candidate)) return candidate as Record<string, string>[];
  }
  return [];
}

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
// Cell Rendering Helpers
// ============================================================================

function getBadgeClasses(value: string): string {
  const lower = value.toLowerCase();
  if (
    lower.includes("crít") ||
    lower.includes("critical") ||
    lower.includes("error") ||
    lower.includes("alto")
  ) {
    return "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
  }
  if (
    lower.includes("medio") ||
    lower.includes("medium") ||
    lower.includes("warning") ||
    lower.includes("advertencia")
  ) {
    return "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
  }
  if (lower.includes("bajo") || lower.includes("low")) {
    return "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
  }
  if (
    lower.includes("ok") ||
    lower.includes("activo") ||
    lower.includes("active") ||
    lower.includes("success")
  ) {
    return "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
  }
  return "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
}

function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-green-500";
  if (pct >= 80) return "bg-orange-400";
  return "bg-red-500";
}

function renderProgress(value: string) {
  const pct = Number.parseFloat(value.replaceAll(/[^\d.]/g, ""));
  const safePct = Number.isNaN(pct) ? 0 : Math.min(100, Math.max(0, pct));
  const barColor = getProgressColor(safePct);
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${safePct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {value}
      </span>
    </div>
  );
}

function getSignedClasses(value: string): string {
  // Strip everything except digits, minus sign, and decimal separator
  const numeric = Number.parseFloat(value.replaceAll(/[^\d.-]/g, ""));
  if (Number.isNaN(numeric)) {
    return "text-gray-700 dark:text-gray-300";
  }
  if (numeric < 0) {
    return "font-semibold text-red-600 dark:text-red-400";
  }
  if (numeric < 1000) {
    return "font-semibold text-orange-500 dark:text-orange-400";
  }
  return "font-semibold text-green-600 dark:text-green-400";
}

function renderCell(value: string, type: ColumnType) {
  if (type === "badge") {
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${getBadgeClasses(value)}`}
      >
        {value}
      </span>
    );
  }
  if (type === "highlight") {
    return (
      <span className="font-semibold text-blue-600 dark:text-blue-400">
        {value}
      </span>
    );
  }
  if (type === "signed") {
    return <span className={getSignedClasses(value)}>{value}</span>;
  }
  if (type === "progress") {
    return renderProgress(value);
  }
  // text — multiline: first line bold, rest as muted subtitle
  const lines = value.split("\n");
  if (lines.length > 1) {
    return (
      <span>
        <span className="block font-semibold text-gray-900 dark:text-white">
          {lines[0]}
        </span>
        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {lines.slice(1).join(" ")}
        </span>
      </span>
    );
  }
  return <span>{value}</span>;
}

// ============================================================================
// Pill Button
// ============================================================================

interface PillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}

function Pill({ label, active, onClick, icon }: Readonly<PillProps>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`no-drag inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      }`}
    >
      {label}
      {icon}
    </button>
  );
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
    pgrestFunctionName = "",
    pgrestParams = [],
    pgrestHttpMethod = "POST",
    sort = defaultSort,
  } = config;
  const filter = useMemo(() => normalizeFilterConfig(config.filter), [config.filter]);

  // ── Dynamic data fetching ───────────────────────────────────────────────────
  const [dynamicRows, setDynamicRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const request = buildDataFetchRequest(
      dataMode, apiUrl, pgrestFunctionName, pgrestParams, pgrestHttpMethod
    );
    if (!request) {
      setLoading(false);
      setFetchError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(request.url, request.init)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!cancelled) setDynamicRows(parseRows(data));
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setFetchError(err instanceof Error ? err.message : "Failed to fetch");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataMode, apiUrl, pgrestFunctionName, pgrestParams, pgrestHttpMethod]);

  // ── Filter & sort state ─────────────────────────────────────────────────────
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allRows = dataMode === "dynamic" || dataMode === "pgrest" ? dynamicRows : staticRows;

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

  // Only show sort pills for columns that actually exist
  const validSortColumns = useMemo(() => {
    const colKeys = new Set(columns.map((c) => c.key));
    return sort.columns.filter((k) => colKeys.has(k));
  }, [sort.columns, columns]);

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
                        {renderCell(String(row[col.key] ?? ""), col.type)}
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
