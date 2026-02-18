"use client";

import { useState, useEffect, useMemo } from "react";
import { HiArrowUp, HiArrowDown } from "react-icons/hi2";
import type { DashletComponentProps, DashletLayoutDefaults } from "../types";

// ============================================================================
// Configuration Types
// ============================================================================

export type ColumnType = "text" | "badge" | "highlight" | "signed";

export interface TableColumn {
  key: string;
  label: string;
  type: ColumnType;
}

export interface FilterConfig {
  enabled: boolean;
  /** Column key whose distinct values are used as filter pills */
  column: string;
  /** Label shown before the filter pills, e.g. "Estado:" */
  label: string;
}

export interface SortConfig {
  enabled: boolean;
  /** Ordered list of column keys available in the sort toolbar */
  columns: string[];
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
  column: "status",
  label: "Estado:",
};

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
    lower.includes("warning")
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

function getSignedClasses(value: string): string {
  // Strip everything except digits, minus sign, and decimal separator
  const numeric = parseFloat(value.replace(/[^\d.-]/g, ""));
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
// Component
// ============================================================================

export function Dashlet({ widget }: Readonly<DashletComponentProps>) {
  const config = widget.config as unknown as DashletConfig;
  const {
    title = defaultConfig.title,
    showRowCount = defaultConfig.showRowCount,
    dataMode = defaultConfig.dataMode,
    columns = defaultColumns,
    rows: staticRows = defaultRows,
    apiUrl = "",
    filter = defaultFilter,
    sort = defaultSort,
  } = config;

  // ── Dynamic data fetching ───────────────────────────────────────────────────
  const [dynamicRows, setDynamicRows] = useState<Record<string, string>[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (dataMode !== "dynamic" || !apiUrl) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        let parsed: Record<string, string>[];
        if (Array.isArray(data)) {
          parsed = data as Record<string, string>[];
        } else if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>;
          const candidate = obj.rows ?? obj.data ?? obj.results;
          parsed = Array.isArray(candidate)
            ? (candidate as Record<string, string>[])
            : [];
        } else {
          parsed = [];
        }
        setDynamicRows(parsed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Failed to fetch");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataMode, apiUrl]);

  // ── Filter & sort state ─────────────────────────────────────────────────────
  const [filterValue, setFilterValue] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const allRows = dataMode === "dynamic" ? dynamicRows : staticRows;

  // Distinct values for the filter pills (derived from full dataset)
  const filterValues = useMemo(() => {
    if (!filter.enabled || !filter.column) return [];
    const seen = new Set<string>();
    for (const row of allRows) {
      const val = row[filter.column];
      if (val) seen.add(val);
    }
    return Array.from(seen);
  }, [allRows, filter.enabled, filter.column]);

  // Column label lookup for sort toolbar
  const getColumnLabel = (key: string) =>
    columns.find((c) => c.key === key)?.label ?? key;

  // Apply filter then sort
  const displayRows = useMemo(() => {
    let result = allRows;

    if (filter.enabled && filterValue) {
      result = result.filter((row) => row[filter.column] === filterValue);
    }

    if (sort.enabled && sortKey) {
      result = [...result].sort((a, b) => {
        const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [allRows, filter, filterValue, sort, sortKey, sortDir]);

  const getSortIcon = (dir: "asc" | "desc") =>
    dir === "asc" ? <HiArrowUp className="h-3 w-3" /> : <HiArrowDown className="h-3 w-3" />;

  const handleSortClick = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
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

      {/* Filter card */}
      {filter.enabled && filterValues.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filter.label}
          </span>
          <Pill
            label="All"
            active={filterValue === ""}
            onClick={() => setFilterValue("")}
          />
          {filterValues.map((val) => (
            <Pill
              key={val}
              label={val}
              active={filterValue === val}
              onClick={() => setFilterValue(val)}
            />
          ))}
        </div>
      )}

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
