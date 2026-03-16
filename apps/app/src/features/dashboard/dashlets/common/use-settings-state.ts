import { useState, useMemo } from "react";
import type { TableColumn, SortConfig } from "./column-types";
import type { FilterConfig, FilterItemConfig } from "./filter-types";
import type { ColumnItem } from "./column-helpers";
import { toColumnItems, fromColumnItems } from "./column-helpers";
import type { FilterItem } from "./filter-helpers";
import { normalizeFilterConfig, toFilterItems, fromFilterItems } from "./filter-helpers";

export interface SettingsStateConfig {
  title: string;
  defaultTitle: string;
  showRowCount: boolean;
  columns: TableColumn[];
  defaultColumns: TableColumn[];
  rows: Record<string, string>[];
  defaultRows: Record<string, string>[];
  filter: unknown;
  defaultFilter: FilterConfig;
  sort: SortConfig | undefined;
  defaultSort: SortConfig;
  dataMode: "static" | "dynamic" | "pgrest";
  apiUrl: string;
}

export function useSettingsState(cfg: SettingsStateConfig) {
  const [dataMode, setDataMode] = useState<"static" | "dynamic" | "pgrest">(
    cfg.dataMode ?? "static",
  );
  const [title, setTitle] = useState(cfg.title ?? cfg.defaultTitle);
  const [showRowCount, setShowRowCount] = useState(cfg.showRowCount ?? true);
  const [columns, setColumns] = useState<ColumnItem[]>(
    toColumnItems(cfg.columns ?? cfg.defaultColumns),
  );

  // Filter config (normalize legacy shapes)
  const normalizedFilter = normalizeFilterConfig(cfg.filter, cfg.defaultFilter);
  const [filterEnabled, setFilterEnabled] = useState(normalizedFilter.enabled);
  const [filterItems, setFilterItems] = useState<FilterItem[]>(
    toFilterItems(normalizedFilter.items),
  );

  // Sort config
  const [sortEnabled, setSortEnabled] = useState(
    cfg.sort?.enabled ?? cfg.defaultSort.enabled,
  );
  const [sortColumns, setSortColumns] = useState<string[]>(
    cfg.sort?.columns ?? cfg.defaultSort.columns,
  );

  // Data provider fields
  const [rowsJson, setRowsJson] = useState(() =>
    JSON.stringify(cfg.rows ?? cfg.defaultRows, null, 2),
  );
  const [rowsJsonError, setRowsJsonError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState(cfg.apiUrl ?? "");

  // Columns that have a key set (for selects / checkbox lists)
  const columnsWithKeys = useMemo(
    () => columns.filter((c) => c.key),
    [columns],
  );

  // ── Column helpers ────────────────────────────────────────────────────────

  const addColumn = () => {
    setColumns((prev) => [
      ...prev,
      { _id: `col-${Date.now()}`, key: "", label: "", type: "text" },
    ]);
  };

  const removeColumn = (id: string) => {
    setColumns((prev) => prev.filter((c) => c._id !== id));
  };

  const updateColumn = (
    id: string,
    field: keyof TableColumn,
    value: string,
  ) => {
    setColumns((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c)),
    );
  };

  // ── Filter item helpers ─────────────────────────────────────────────────

  const addFilterItem = () => {
    const firstCol = columns.find((c) => c.key)?.key ?? "";
    setFilterItems((prev) => [
      ...prev,
      { _id: `fi-${Date.now()}`, column: firstCol, label: "" },
    ]);
  };

  const removeFilterItem = (id: string) => {
    setFilterItems((prev) => prev.filter((f) => f._id !== id));
  };

  const updateFilterItem = (
    id: string,
    field: keyof FilterItemConfig,
    value: string,
  ) => {
    setFilterItems((prev) =>
      prev.map((f) => (f._id === id ? { ...f, [field]: value } : f)),
    );
  };

  // ── Sort helper ──────────────────────────────────────────────────────────

  const handleSortColumnToggle = (checked: boolean, key: string) => {
    setSortColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key),
    );
  };

  // ── Rows JSON parse ──────────────────────────────────────────────────────

  const parseRows = (
    errorMustBeArray: string,
    errorInvalidJson: string,
  ): Record<string, string>[] | null => {
    if (dataMode === "dynamic" || dataMode === "pgrest") return cfg.rows ?? cfg.defaultRows;
    try {
      const parsed = JSON.parse(rowsJson);
      if (!Array.isArray(parsed)) {
        setRowsJsonError(errorMustBeArray);
        return null;
      }
      setRowsJsonError(null);
      return parsed as Record<string, string>[];
    } catch {
      setRowsJsonError(errorInvalidJson);
      return null;
    }
  };

  // ── Build filter/sort for save ──────────────────────────────────────────

  const buildFilterSort = () => {
    const savedColumns = fromColumnItems(columns);
    const validKeys = new Set(savedColumns.map((c) => c.key).filter(Boolean));

    const filter: FilterConfig = {
      enabled: filterEnabled,
      items: fromFilterItems(filterItems).filter((fi) =>
        validKeys.has(fi.column),
      ),
    };
    const sort: SortConfig = {
      enabled: sortEnabled,
      columns: sortColumns.filter((k) => validKeys.has(k)),
    };

    return { filter, sort, savedColumns, validKeys };
  };

  return {
    // State
    dataMode,
    setDataMode,
    title,
    setTitle,
    showRowCount,
    setShowRowCount,
    columns,
    setColumns,
    columnsWithKeys,
    filterEnabled,
    setFilterEnabled,
    filterItems,
    setFilterItems,
    sortEnabled,
    setSortEnabled,
    sortColumns,
    setSortColumns,
    rowsJson,
    setRowsJson,
    rowsJsonError,
    setRowsJsonError,
    apiUrl,
    setApiUrl,
    // Helpers
    addColumn,
    removeColumn,
    updateColumn,
    addFilterItem,
    removeFilterItem,
    updateFilterItem,
    handleSortColumnToggle,
    parseRows,
    buildFilterSort,
    fromColumnItems,
  };
}
