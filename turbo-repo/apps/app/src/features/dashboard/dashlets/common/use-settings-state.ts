import { useState, useMemo } from "react";
import type { DataMode, TableColumn, SortConfig } from "./column-types";
import type { FilterConfig, FilterItemConfig } from "./filter-types";
import type { ColumnItem } from "./column-helpers";
import { toColumnItems, fromColumnItems } from "./column-helpers";
import type { FilterItem } from "./filter-helpers";
import {
  normalizeFilterConfig,
  toFilterItems,
  fromFilterItems,
} from "./filter-helpers";
import type { ColorRulesConfig } from "./color-rule-types";
import { DEFAULT_RULE_COLOR } from "./color-rule-types";
import type { ColorRuleItem } from "./color-rule-helpers";
import {
  toColorRuleItems,
  fromColorRuleItems,
  normalizeColorRulesConfig,
} from "./color-rule-helpers";
import type { ActionsConfig } from "./action-types";
import type { ActionItemWithId } from "./action-helpers";
import {
  toActionItems,
  fromActionItems,
  normalizeActionsConfig,
} from "./action-helpers";

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
  dataMode: DataMode;
  apiUrl: string;
  rowColorRules?: ColorRulesConfig;
  actions?: ActionsConfig;
}

// ── Pure helpers for colorMap mutations (kept flat to avoid nesting) ────────

let _cmCounter = 0;

function appendColorMapping(col: ColumnItem, targetId: string): ColumnItem {
  if (col._id !== targetId) return col;
  return {
    ...col,
    colorMap: [
      ...(col.colorMap ?? []),
      {
        _id: `cm-${Date.now()}-${_cmCounter++}`,
        operator: "equals",
        value: "",
        color: DEFAULT_RULE_COLOR,
      },
    ],
  };
}

function dropColorMapping(
  col: ColumnItem,
  targetId: string,
  mappingId: string
): ColumnItem {
  if (col._id !== targetId) return col;
  return {
    ...col,
    colorMap: (col.colorMap ?? []).filter((m) => m._id !== mappingId),
  };
}

function patchColorMapping(
  col: ColumnItem,
  targetId: string,
  mappingId: string,
  field: string,
  val: string
): ColumnItem {
  if (col._id !== targetId) return col;
  return {
    ...col,
    colorMap: (col.colorMap ?? []).map((m) =>
      m._id === mappingId ? { ...m, [field]: val } : m
    ),
  };
}

// ============================================================================

export function useSettingsState(cfg: SettingsStateConfig) {
  const [dataMode, setDataMode] = useState<DataMode>(cfg.dataMode ?? "static");
  const [title, setTitle] = useState(cfg.title ?? cfg.defaultTitle);
  const [showRowCount, setShowRowCount] = useState(cfg.showRowCount ?? true);
  const [columns, setColumns] = useState<ColumnItem[]>(
    toColumnItems(cfg.columns ?? cfg.defaultColumns)
  );

  // Filter config (normalize legacy shapes)
  const normalizedFilter = normalizeFilterConfig(cfg.filter, cfg.defaultFilter);
  const [filterEnabled, setFilterEnabled] = useState(normalizedFilter.enabled);
  const [filterItems, setFilterItems] = useState<FilterItem[]>(
    toFilterItems(normalizedFilter.items)
  );

  // Sort config
  const [sortEnabled, setSortEnabled] = useState(
    cfg.sort?.enabled ?? cfg.defaultSort.enabled
  );
  const [sortColumns, setSortColumns] = useState<string[]>(
    cfg.sort?.columns ?? cfg.defaultSort.columns
  );

  // Color rules
  const defaultColorRules: ColorRulesConfig = { enabled: false, rules: [] };
  const normalizedRowColorRules = normalizeColorRulesConfig(
    cfg.rowColorRules,
    defaultColorRules
  );

  const [rowColorRulesEnabled, setRowColorRulesEnabled] = useState(
    normalizedRowColorRules.enabled
  );
  const [rowColorRuleItems, setRowColorRuleItems] = useState<ColorRuleItem[]>(
    toColorRuleItems(normalizedRowColorRules.rules)
  );

  // Actions config
  const defaultActions: ActionsConfig = { enabled: false, items: [] };
  const normalizedActions = normalizeActionsConfig(cfg.actions, defaultActions);
  const [actionsEnabled, setActionsEnabled] = useState(
    normalizedActions.enabled
  );
  const [actionItems, setActionItems] = useState<ActionItemWithId[]>(
    toActionItems(normalizedActions.items)
  );

  // Data provider fields
  const [rowsJson, setRowsJson] = useState(() =>
    JSON.stringify(cfg.rows ?? cfg.defaultRows, null, 2)
  );
  const [rowsJsonError, setRowsJsonError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState(cfg.apiUrl ?? "");

  // Columns that have a key set (for selects / checkbox lists)
  const columnsWithKeys = useMemo(
    () => columns.filter((c) => c.key),
    [columns]
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
    value: string | boolean
  ) => {
    setColumns((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c))
    );
  };

  // ── Column colorMap helpers (for badge columns) ────────────────────────

  const addColorMapping = (colId: string) => {
    setColumns((prev) => prev.map((c) => appendColorMapping(c, colId)));
  };

  const removeColorMapping = (colId: string, mappingId: string) => {
    setColumns((prev) =>
      prev.map((c) => dropColorMapping(c, colId, mappingId))
    );
  };

  const updateColorMapping = (
    colId: string,
    mappingId: string,
    field: "operator" | "value" | "color",
    val: string
  ) => {
    setColumns((prev) =>
      prev.map((c) => patchColorMapping(c, colId, mappingId, field, val))
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
    value: string
  ) => {
    setFilterItems((prev) =>
      prev.map((f) => (f._id === id ? { ...f, [field]: value } : f))
    );
  };

  // ── Sort helper ──────────────────────────────────────────────────────────

  const handleSortColumnToggle = (checked: boolean, key: string) => {
    setSortColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  // ── Color rule helpers ────────────────────────────────────────────────────

  const addRowColorRule = () => {
    const firstCol = columns.find((c) => c.key)?.key ?? "";
    setRowColorRuleItems((prev) => [
      ...prev,
      {
        _id: `cr-${Date.now()}`,
        column: firstCol,
        operator: "equals" as const,
        value: "",
        color: DEFAULT_RULE_COLOR,
      },
    ]);
  };

  const removeRowColorRule = (id: string) => {
    setRowColorRuleItems((prev) => prev.filter((r) => r._id !== id));
  };

  const updateRowColorRule = (id: string, field: string, value: string) => {
    setRowColorRuleItems((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
    );
  };

  // ── Action helpers ─────────────────────────────────────────────────────

  const addAction = () => {
    setActionItems((prev) => [
      ...prev,
      {
        _id: `act-${Date.now()}`,
        name: "",
        link: "",
        target: "_blank" as const,
      },
    ]);
  };

  const removeAction = (id: string) => {
    setActionItems((prev) => prev.filter((a) => a._id !== id));
  };

  const updateAction = (
    id: string,
    field: "name" | "link" | "target",
    value: string
  ) => {
    setActionItems((prev) =>
      prev.map((a) => (a._id === id ? { ...a, [field]: value } : a))
    );
  };

  // ── Rows JSON parse ──────────────────────────────────────────────────────

  const parseRows = (
    errorMustBeArray: string,
    errorInvalidJson: string
  ): Record<string, string>[] | null => {
    if (
      dataMode === "dynamic" ||
      dataMode === "pgrest" ||
      dataMode === "planner"
    )
      return cfg.rows ?? cfg.defaultRows;
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
        validKeys.has(fi.column)
      ),
    };
    const sort: SortConfig = {
      enabled: sortEnabled,
      columns: sortColumns.filter((k) => validKeys.has(k)),
    };

    const rowColorRules: ColorRulesConfig = {
      enabled: rowColorRulesEnabled,
      rules: fromColorRuleItems(rowColorRuleItems).filter((r) =>
        validKeys.has(r.column)
      ),
    };

    const actions: ActionsConfig = {
      enabled: actionsEnabled,
      items: fromActionItems(actionItems),
    };

    return { filter, sort, savedColumns, validKeys, rowColorRules, actions };
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
    // Color rules — row
    rowColorRulesEnabled,
    setRowColorRulesEnabled,
    rowColorRuleItems,
    addRowColorRule,
    removeRowColorRule,
    updateRowColorRule,
    // Actions
    actionsEnabled,
    setActionsEnabled,
    actionItems,
    addAction,
    removeAction,
    updateAction,
    // Helpers
    addColumn,
    removeColumn,
    updateColumn,
    addColorMapping,
    removeColorMapping,
    updateColorMapping,
    addFilterItem,
    removeFilterItem,
    updateFilterItem,
    handleSortColumnToggle,
    parseRows,
    buildFilterSort,
    fromColumnItems,
  };
}
