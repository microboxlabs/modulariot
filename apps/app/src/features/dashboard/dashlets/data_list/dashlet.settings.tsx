"use client";

import { useState } from "react";
import {
  Button,
  TextInput,
  Textarea,
  Label,
  ToggleSwitch,
  Select,
} from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { createPortal } from "react-dom";
import { twMerge } from "tailwind-merge";
import type { DashletSettingsProps } from "../types";
import type {
  DashletConfig,
  TableColumn,
  ColumnType,
  FilterConfig,
  FilterItemConfig,
  SortConfig,
  CardLayoutConfig,
} from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  defaultCardLayout,
  normalizeFilterConfig,
} from "./dashlet";
import { SettingsTextField, SettingsSelectField } from "../common";
import type { ColumnItem } from "../common/column-helpers";
import { toColumnItems, fromColumnItems } from "../common/column-helpers";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

interface FilterItem extends FilterItemConfig {
  _id: string;
}

function toFilterItems(items: FilterItemConfig[]): FilterItem[] {
  return items.map((item, i) => ({ ...item, _id: `fi-${i}-${item.column}` }));
}

function fromFilterItems(items: FilterItem[]): FilterItemConfig[] {
  return items.map(({ column, label }) => ({ column, label }));
}

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
  const [dataMode, setDataMode] = useState<"static" | "dynamic">(
    config.dataMode ?? "static"
  );

  // Visualization fields
  const [title, setTitle] = useState(config.title ?? "Data List");
  const [showRowCount, setShowRowCount] = useState(
    config.showRowCount ?? true
  );
  const [columns, setColumns] = useState<ColumnItem[]>(
    toColumnItems(config.columns ?? defaultColumns)
  );

  // Filter config (normalize legacy shapes)
  const normalizedFilter = normalizeFilterConfig(config.filter);
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

  // Card layout config
  const cl = config.cardLayout ?? defaultCardLayout;
  const [titleColumn, setTitleColumn] = useState(cl.titleColumn);
  const [subtitleColumn, setSubtitleColumn] = useState(cl.subtitleColumn);
  const [headerBadgeColumns, setHeaderBadgeColumns] = useState<string[]>(
    cl.headerBadgeColumns
  );
  const [kpiColumns, setKpiColumns] = useState<string[]>(cl.kpiColumns);
  const [footerColumns, setFooterColumns] = useState<string[]>(
    cl.footerColumns
  );

  // Data provider fields
  const [rowsJson, setRowsJson] = useState(() =>
    JSON.stringify(config.rows ?? defaultRows, null, 2)
  );
  const [rowsJsonError, setRowsJsonError] = useState<string | null>(null);
  const [apiUrl, setApiUrl] = useState(config.apiUrl ?? "");

  const handleSortColumnToggle = (checked: boolean, key: string) => {
    setSortColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  const handleCheckboxListToggle = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    checked: boolean,
    key: string
  ) => {
    setter((prev) =>
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
    let rows = config.rows ?? defaultRows;

    if (dataMode === "static") {
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) {
          setRowsJsonError(tr("dashboard.settings.mustBeJsonArray", dictionary));
          return;
        }
        rows = parsed as Record<string, string>[];
        setRowsJsonError(null);
      } catch {
        setRowsJsonError(tr("dashboard.settings.invalidJson", dictionary));
        return;
      }
    }

    const savedColumns = fromColumnItems(columns);
    const validKeys = new Set(savedColumns.map((c) => c.key).filter(Boolean));

    const filter: FilterConfig = {
      enabled: filterEnabled,
      items: fromFilterItems(filterItems).filter((fi) => validKeys.has(fi.column)),
    };
    const sort: SortConfig = {
      enabled: sortEnabled,
      columns: sortColumns.filter((k) => validKeys.has(k)),
    };
    const cardLayout: CardLayoutConfig = {
      titleColumn: validKeys.has(titleColumn) ? titleColumn : "",
      subtitleColumn: validKeys.has(subtitleColumn) ? subtitleColumn : "",
      headerBadgeColumns: headerBadgeColumns.filter((k) => validKeys.has(k)),
      kpiColumns: kpiColumns.filter((k) => validKeys.has(k)),
      footerColumns: footerColumns.filter((k) => validKeys.has(k)),
    };

    onSave({
      title,
      showRowCount,
      dataMode,
      columns: fromColumnItems(columns),
      rows,
      apiUrl,
      filter,
      sort,
      cardLayout,
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

  const columnsWithKeys = columns.filter((c) => c.key);

  const modalContent = (
    <AbsoluteModal
      selected={isOpen}
      setSelected={(selected) => {
        if (!selected) onClose();
      }}
      className="no-drag w-96 rounded-lg border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <div className="flex w-full max-h-[75vh] flex-col gap-3">
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
        <div className="flex-1 space-y-3 overflow-y-auto">
          {activeTab === "visualization" ? (
            <>
              {/* Title */}
              <SettingsTextField
                id="dl-title"
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
                <Label className="mb-1.5 block text-sm font-medium">
                  {tr("dashboard.settings.columns", dictionary)}
                </Label>
                <div className="space-y-1.5">
                  {columns.map((col) => (
                    <div key={col._id} className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <TextInput
                          sizing="sm"
                          placeholder={tr("dashboard.settings.key", dictionary)}
                          value={col.key}
                          onChange={(e) =>
                            updateColumn(col._id, "key", e.target.value)
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <TextInput
                          sizing="sm"
                          placeholder={tr("dashboard.settings.label", dictionary)}
                          value={col.label}
                          onChange={(e) =>
                            updateColumn(col._id, "label", e.target.value)
                          }
                        />
                      </div>
                      <div className="w-24 shrink-0">
                        <Select
                          sizing="sm"
                          value={col.type}
                          onChange={(e) =>
                            updateColumn(
                              col._id,
                              "type",
                              e.target.value as ColumnType
                            )
                          }
                        >
                          <option value="text">text</option>
                          <option value="badge">badge</option>
                          <option value="highlight">highlight</option>
                          <option value="signed">signed</option>
                          <option value="progress">progress</option>
                        </Select>
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

              {/* ── Card Layout ─────────────────────────────────────── */}
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="space-y-2">
                <Label className="text-sm font-semibold">{tr("dashboard.settings.cardLayout", dictionary)}</Label>

                {/* Title column */}
                <div>
                  <Label
                    htmlFor="dl-title-col"
                    className="mb-1 block text-sm font-medium"
                  >
                    {tr("dashboard.settings.titleColumn", dictionary)}
                  </Label>
                  <Select
                    id="dl-title-col"
                    sizing="sm"
                    value={titleColumn}
                    onChange={(e) => setTitleColumn(e.target.value)}
                  >
                    <option value="">{tr("dashboard.settings.none", dictionary)}</option>
                    {columnsWithKeys.map((c) => (
                      <option key={c._id} value={c.key}>
                        {c.label || c.key}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Subtitle column */}
                <div>
                  <Label
                    htmlFor="dl-subtitle-col"
                    className="mb-1 block text-sm font-medium"
                  >
                    {tr("dashboard.settings.subtitleColumn", dictionary)}
                  </Label>
                  <Select
                    id="dl-subtitle-col"
                    sizing="sm"
                    value={subtitleColumn}
                    onChange={(e) => setSubtitleColumn(e.target.value)}
                  >
                    <option value="">{tr("dashboard.settings.none", dictionary)}</option>
                    {columnsWithKeys.map((c) => (
                      <option key={c._id} value={c.key}>
                        {c.label || c.key}
                      </option>
                    ))}
                  </Select>
                </div>

                {/* Header badge columns (checkboxes) */}
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">
                    {tr("dashboard.settings.headerBadgeColumns", dictionary)}
                  </Label>
                  <div className="space-y-1">
                    {columnsWithKeys.map((c) => (
                      <label
                        key={c._id}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={headerBadgeColumns.includes(c.key)}
                          onChange={(e) =>
                            handleCheckboxListToggle(
                              setHeaderBadgeColumns,
                              e.target.checked,
                              c.key
                            )
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

                {/* KPI columns (checkboxes) */}
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">
                    {tr("dashboard.settings.kpiGridColumns", dictionary)}
                  </Label>
                  <div className="space-y-1">
                    {columnsWithKeys.map((c) => (
                      <label
                        key={c._id}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={kpiColumns.includes(c.key)}
                          onChange={(e) =>
                            handleCheckboxListToggle(
                              setKpiColumns,
                              e.target.checked,
                              c.key
                            )
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

                {/* Footer columns (checkboxes) */}
                <div>
                  <Label className="mb-1.5 block text-sm font-medium">
                    {tr("dashboard.settings.footerColumns", dictionary)}
                  </Label>
                  <div className="space-y-1">
                    {columnsWithKeys.map((c) => (
                      <label
                        key={c._id}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={footerColumns.includes(c.key)}
                          onChange={(e) =>
                            handleCheckboxListToggle(
                              setFooterColumns,
                              e.target.checked,
                              c.key
                            )
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
              </div>

              {/* ── Filter ─────────────────────────────────────────── */}
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
                          <div className="min-w-0 flex-1">
                            <TextInput
                              sizing="sm"
                              placeholder={tr("dashboard.settings.label", dictionary)}
                              value={fi.label}
                              onChange={(e) =>
                                updateFilterItem(
                                  fi._id,
                                  "label",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <Select
                              sizing="sm"
                              value={fi.column}
                              onChange={(e) =>
                                updateFilterItem(
                                  fi._id,
                                  "column",
                                  e.target.value
                                )
                              }
                            >
                              {columnsWithKeys.map((c) => (
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

              {/* ── Sort ───────────────────────────────────────────── */}
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
                      {columnsWithKeys.map((c) => (
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
                id="dl-data-mode"
                label={tr("dashboard.settings.dataSource", dictionary)}
                value={dataMode}
                onChange={(v) => setDataMode(v as "static" | "dynamic")}
                options={[
                  { value: "static", label: tr("dashboard.settings.staticJson", dictionary) },
                  { value: "dynamic", label: tr("dashboard.settings.dynamicApi", dictionary) },
                ]}
              />

              {/* Static: JSON rows */}
              {dataMode === "static" && (
                <div>
                  <Label
                    htmlFor="dl-rows-json"
                    className="mb-1 block text-sm font-medium"
                  >
                    {tr("dashboard.settings.rowsJsonArray", dictionary)}
                  </Label>
                  <Textarea
                    id="dl-rows-json"
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

              {/* Dynamic: API URL */}
              {dataMode === "dynamic" && (
                <SettingsTextField
                  id="dl-api-url"
                  label={tr("dashboard.settings.apiUrl", dictionary)}
                  value={apiUrl}
                  onChange={setApiUrl}
                />
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
