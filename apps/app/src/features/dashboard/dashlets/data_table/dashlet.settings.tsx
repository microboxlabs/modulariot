"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import {
  Label,
  Button,
  TextInput,
  Select,
  ToggleSwitch,
  Textarea,
} from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { DashletSettingsProps } from "../types";
import type {
  DashletConfig,
  TableColumn,
  FilterItemConfig,
  FilterConfig,
  SortConfig,
} from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  defaultFilter,
  normalizeFilterConfig,
} from "./dashlet";
import {
  SettingsTextField,
  SettingsSelectField,
  getHandlebarsStatus,
  getFlowbiteColor,
  SuggestionInput,
  usePgrestSettingsState,
  PgrestSettingsSection,
  fromPgrestParamItems,
  buildPgrestSettingsConfig,
  buildPgrestContentLabels,
} from "../common";
import { COLUMN_TYPES } from "../common/column-types";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { tr } from "@/features/i18n/tr.service";

import type { ColumnItem } from "../common/column-helpers";
import { toColumnItems, fromColumnItems } from "../common/column-helpers";
import { toFilterItems, fromFilterItems, type FilterItem } from "../common/filter-helpers";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

// ============================================================================
// Component
// ============================================================================

export function DashletSettings({
  isOpen,
  onClose,
  config,
  onSave,
  dictionary,
}: Readonly<DashletSettingsProps<DashletConfig>>) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("visualization");
  const [dataMode, setDataMode] = useState<"static" | "pgrest">(
    config.dataMode === "pgrest" ? "pgrest" : "static"
  );

  // Visualization fields
  const [title, setTitle] = useState(config.title ?? "Data Table");
  const [showRowCount, setShowRowCount] = useState(
    config.showRowCount ?? true
  );
  const [columns, setColumns] = useState<ColumnItem[]>(
    toColumnItems(config.columns ?? defaultColumns)
  );

  // Filter config (normalize legacy shapes)
  const normalizedFilter = normalizeFilterConfig(config.filter, defaultFilter);
  const [filterEnabled, setFilterEnabled] = useState(normalizedFilter.enabled);
  const [filterItems, setFilterItems] = useState<FilterItem[]>(
    toFilterItems(normalizedFilter.items)
  );

  // Sort config
  const [sortEnabled, setSortEnabled] = useState(
    config.sort?.enabled ?? defaultSort.enabled
  );
  const [sortColumns, setSortColumns] = useState<string[]>(
    config.sort?.columns ?? defaultSort.columns
  );

  // Data provider fields
  const [rowsJson, setRowsJson] = useState(() =>
    JSON.stringify(config.rows ?? defaultRows, null, 2)
  );
  const [rowsJsonError, setRowsJsonError] = useState<string | null>(null);

  const pgrestCallbacks = buildPgrestSettingsConfig({
    setColumns,
    setFilterItems,
    setSortColumns,
  });
  const pg = usePgrestSettingsState({
    pgrestFunctionName: config.pgrestFunctionName ?? "",
    pgrestParams: config.pgrestParams ?? [],
    pgrestHttpMethod: config.pgrestHttpMethod ?? "POST",
    ...pgrestCallbacks,
  });

  const handleSortColumnToggle = (checked: boolean, key: string) => {
    setSortColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  // ── Column helpers ──────────────────────────────────────────────────────────

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
    value: string
  ) => {

    setColumns((prev) =>
      prev.map((c) => (c._id === id ? { ...c, [field]: value } : c))
    );
  };

  // ── Filter item helpers ───────────────────────────────────────────────────

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

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    // Parse rows for static mode
    let parsedRows: Record<string, string>[] | undefined;
    if (dataMode === "static") {
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) {
          setRowsJsonError("Must be a JSON array");
          return;
        }
        setRowsJsonError(null);
        parsedRows = parsed as Record<string, string>[];
      } catch {
        setRowsJsonError("Invalid JSON");
        return;
      }
    }

    // Build filter/sort from current state
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

    onSave({
      title,
      showRowCount,
      dataMode,
      columns: savedColumns,
      rows: parsedRows ?? config.rows ?? defaultRows,
      pgrestFunctionName: pg.pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pg.pgrestParams),
      pgrestHttpMethod: pg.pgrestHttpMethod,
      filter,
      sort,
    });
    onClose();
  };

  if (globalThis.window === undefined) return null;

  const handleMouseDown = (e: React.MouseEvent) => e.stopPropagation();

  const tabClass = (tab: SettingsTab) =>
    twMerge(
      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
      activeTab === tab
        ? "border-blue-500 text-blue-600 dark:text-blue-400"
        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400"
    );

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full flex-col gap-3 max-h-[75vh]">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab("visualization")}
            className={tabClass("visualization")}
          >
            {tr("dashboard.settings.visualization", dictionary)}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("data")}
            className={tabClass("data")}
          >
            {tr("dashboard.settings.dataProvider", dictionary)}
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeTab === "visualization" ? (
            <>
              {/* Title */}
              <SettingsTextField
                id="dt-title"
                label={tr("common.title", dictionary)}
                value={title}
                onChange={setTitle}
              />

              {/* Show row count */}
              <div className="flex items-center justify-between py-0.5">
                <Label className="text-sm font-medium">{tr("dashboard.settings.showRowCount", dictionary)}</Label>
                <ToggleSwitch
                  checked={showRowCount}
                  onChange={setShowRowCount}
                  sizing="sm"
                />
              </div>

              {/* Columns editor */}
              <div>
                <Label className="mb-1.5 block text-sm font-medium">{tr("dashboard.settings.columns", dictionary)}</Label>
                <div className="space-y-1.5">
                  {columns.map((col) => (
                    <div key={col._id} className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <TextInput
                          sizing="sm"
                          placeholder={tr("dashboard.settings.key", dictionary)}
                          value={col.key}
                          onChange={(e) =>
                            updateColumn(col._id, "key", e.target.value)
                          }
                          color={getFlowbiteColor(getHandlebarsStatus(col.key))}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <TextInput
                          sizing="sm"
                          placeholder={tr("dashboard.settings.label", dictionary)}
                          value={col.label}
                          onChange={(e) =>
                            updateColumn(col._id, "label", e.target.value)
                          }
                          color={getFlowbiteColor(getHandlebarsStatus(col.label))}
                        />
                      </div>
                      <div className="w-28 shrink-0">
                        <SuggestionInput
                          sizing="sm"
                          placeholder="text"
                          value={col.type}
                          onChange={(v) => updateColumn(col._id, "type", v)}
                          suggestions={COLUMN_TYPES}
                          color={getFlowbiteColor(getHandlebarsStatus(col.type))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeColumn(col._id)}
                        onMouseDown={handleMouseDown}
                        className="no-drag shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                      >
                        <HiTrash className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  color="light"
                  size="xs"
                  onClick={addColumn}
                  onMouseDown={handleMouseDown}
                  className="no-drag mt-2"
                >
                  <HiPlus className="mr-1 h-3 w-3" />
                  {tr("dashboard.settings.addColumn", dictionary)}
                </Button>
              </div>

              {/* ── Filter ─────────────────────────────────────────────── */}
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{tr("dashboard.settings.filter", dictionary)}</Label>
                  <ToggleSwitch
                    checked={filterEnabled}
                    onChange={setFilterEnabled}
                    sizing="sm"
                  />
                </div>

                {filterEnabled && (
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium">
                      {tr("dashboard.settings.filterRows", dictionary)}
                    </Label>
                    <div className="space-y-1.5">
                      {filterItems.map((fi) => (
                        <div key={fi._id} className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <TextInput
                              sizing="sm"
                              placeholder={tr("dashboard.settings.label", dictionary)}
                              value={fi.label}
                              onChange={(e) =>
                                updateFilterItem(fi._id, "label", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <Select
                              sizing="sm"
                              value={fi.column}
                              onChange={(e) =>
                                updateFilterItem(fi._id, "column", e.target.value)
                              }
                            >
                              {columns
                                .filter((c) => c.key)
                                .map((c) => (
                                  <option key={c._id} value={c.key}>
                                    {c.label || c.key}
                                  </option>
                                ))}
                            </Select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFilterItem(fi._id)}
                            onMouseDown={handleMouseDown}
                            className="no-drag shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
                          >
                            <HiTrash className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      color="light"
                      size="xs"
                      onClick={addFilterItem}
                      onMouseDown={handleMouseDown}
                      className="no-drag mt-2"
                    >
                      <HiPlus className="mr-1 h-3 w-3" />
                      {tr("dashboard.settings.addFilter", dictionary)}
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Sort ───────────────────────────────────────────────── */}
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{tr("dashboard.settings.sort", dictionary)}</Label>
                  <ToggleSwitch
                    checked={sortEnabled}
                    onChange={setSortEnabled}
                    sizing="sm"
                  />
                </div>

                {sortEnabled && (
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium">
                      {tr("dashboard.settings.sortableColumns", dictionary)}
                    </Label>
                    <div className="space-y-1">
                      {columns
                        .filter((c) => c.key)
                        .map((c) => (
                          <label
                            key={c._id}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={sortColumns.includes(c.key)}
                              onChange={(e) =>
                                handleSortColumnToggle(e.target.checked, c.key)
                              }
                              className="no-drag h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {c.label || c.key}
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Data source mode */}
              <SettingsSelectField
                id="dt-data-mode"
                label={tr("dashboard.settings.dataSource", dictionary)}
                value={dataMode}
                onChange={(v) =>
                  setDataMode(v as "static" | "pgrest")
                }
                options={[
                  { value: "static", label: "Static (JSON)" },
                  { value: "pgrest", label: "PGREST" },
                ]}
              />

              {/* Static: JSON rows */}
              {dataMode === "static" && (
                <div>
                  <Label
                    htmlFor="dt-rows-json"
                    className="mb-1 block text-sm font-medium"
                  >
                    Rows (JSON array)
                  </Label>
                  <Textarea
                    id="dt-rows-json"
                    value={rowsJson}
                    onChange={(e) => {
                      setRowsJson(e.target.value);
                      setRowsJsonError(null);
                    }}
                    rows={8}
                    color={rowsJsonError ? "failure" : "gray"}
                    className="font-mono text-xs"
                    placeholder='[{"key": "value"}]'
                  />
                  {rowsJsonError && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {rowsJsonError}
                    </p>
                  )}
                </div>
              )}

              {/* PGREST: Function name + params */}
              {dataMode === "pgrest" && (
                <PgrestSettingsSection pgrest={pg} labels={buildPgrestContentLabels(dictionary)} />
              )}
            </>
          )}
        </div>

        {/* Save button */}
        <Button
          onClick={handleSave}
          onMouseDown={handleMouseDown}
          size="sm"
          className="no-drag w-full shrink-0"
        >
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
