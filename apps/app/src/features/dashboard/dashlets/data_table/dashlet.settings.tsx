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
  SortConfig,
} from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultFilter,
  defaultSort,
} from "./dashlet";
import { SettingsTextField, SettingsSelectField } from "../common";
import AbsoluteModal from "@/features/common/components/absolute-modal/absolute-modal";
import { tr } from "@/features/i18n/tr.service";

// ============================================================================
// Types
// ============================================================================

type SettingsTab = "visualization" | "data";

interface ColumnItem extends TableColumn {
  _id: string;
}

// ============================================================================
// Helpers
// ============================================================================

function toColumnItems(columns: TableColumn[]): ColumnItem[] {
  return columns.map((col, i) => ({ ...col, _id: `col-${i}-${col.key}` }));
}

function fromColumnItems(items: ColumnItem[]): TableColumn[] {
  return items.map(({ key, label, type }) => ({ key, label, type }));
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
  const [title, setTitle] = useState(config.title ?? "Data Table");
  const [showRowCount, setShowRowCount] = useState(
    config.showRowCount ?? true
  );
  const [columns, setColumns] = useState<ColumnItem[]>(
    toColumnItems(config.columns ?? defaultColumns)
  );

  // Filter config
  const [filterEnabled, setFilterEnabled] = useState(
    config.filter?.enabled ?? defaultFilter.enabled
  );
  const [filterColumn, setFilterColumn] = useState(
    config.filter?.column ?? defaultFilter.column
  );
  const [filterLabel, setFilterLabel] = useState(
    config.filter?.label ?? defaultFilter.label
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
  const [apiUrl, setApiUrl] = useState(config.apiUrl ?? "");

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

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    let rows = config.rows ?? defaultRows;

    if (dataMode === "static") {
      try {
        const parsed = JSON.parse(rowsJson);
        if (!Array.isArray(parsed)) {
          setRowsJsonError("Must be a JSON array");
          return;
        }
        rows = parsed as Record<string, string>[];
        setRowsJsonError(null);
      } catch {
        setRowsJsonError("Invalid JSON");
        return;
      }
    }

    const filter: FilterConfig = {
      enabled: filterEnabled,
      column: filterColumn,
      label: filterLabel,
    };
    const sort: SortConfig = {
      enabled: sortEnabled,
      columns: sortColumns,
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
      <div className="flex w-full flex-col gap-3 max-h-[70vh]">
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
                label="Title"
                value={title}
                onChange={setTitle}
              />

              {/* Show row count */}
              <div className="flex items-center justify-between py-0.5">
                <Label className="text-sm font-medium">Show row count</Label>
                <ToggleSwitch
                  checked={showRowCount}
                  onChange={setShowRowCount}
                  sizing="sm"
                />
              </div>

              {/* Columns editor */}
              <div>
                <Label className="mb-1.5 block text-sm font-medium">
                  Columns
                </Label>
                <div className="space-y-1.5">
                  {columns.map((col) => (
                    <div key={col._id} className="flex items-center gap-1">
                      <div className="flex-1 min-w-0">
                        <TextInput
                          sizing="sm"
                          placeholder="key"
                          value={col.key}
                          onChange={(e) =>
                            updateColumn(col._id, "key", e.target.value)
                          }
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <TextInput
                          sizing="sm"
                          placeholder="label"
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
                  Add column
                </Button>
              </div>

              {/* ── Filter ─────────────────────────────────────────────── */}
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Filter</Label>
                  <ToggleSwitch
                    checked={filterEnabled}
                    onChange={setFilterEnabled}
                    sizing="sm"
                  />
                </div>

                {filterEnabled && (
                  <>
                    <SettingsTextField
                      id="dt-filter-label"
                      label="Filter label"
                      value={filterLabel}
                      onChange={setFilterLabel}
                    />
                    <div>
                      <Label
                        htmlFor="dt-filter-column"
                        className="mb-1 block text-sm font-medium"
                      >
                        Filter by column
                      </Label>
                      <Select
                        id="dt-filter-column"
                        sizing="sm"
                        value={filterColumn}
                        onChange={(e) => setFilterColumn(e.target.value)}
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
                  </>
                )}
              </div>

              {/* ── Sort ───────────────────────────────────────────────── */}
              <hr className="border-gray-200 dark:border-gray-700" />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Sort</Label>
                  <ToggleSwitch
                    checked={sortEnabled}
                    onChange={setSortEnabled}
                    sizing="sm"
                  />
                </div>

                {sortEnabled && (
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium">
                      Sortable columns
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
                label="Data Source"
                value={dataMode}
                onChange={(v) => setDataMode(v as "static" | "dynamic")}
                options={[
                  { value: "static", label: "Static (JSON)" },
                  { value: "dynamic", label: "Dynamic (API)" },
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

              {/* Dynamic: API URL */}
              {dataMode === "dynamic" && (
                <SettingsTextField
                  id="dt-api-url"
                  label="API URL"
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
          className="no-drag w-full"
        >
          {tr("common.save", dictionary)}
        </Button>
      </div>
    </AbsoluteModal>
  );

  return createPortal(modalContent, document.body);
}
