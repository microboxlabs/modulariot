"use client";

import { useState } from "react";
import {
  Button,
  Spinner,
  TextInput,
  Textarea,
  Label,
  ToggleSwitch,
  Select,
} from "flowbite-react";
import { HiMagnifyingGlass, HiPlus, HiTrash } from "react-icons/hi2";
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
  PgrestParam,
  PgrestHttpMethod,
} from "./dashlet";
import {
  defaultColumns,
  defaultRows,
  defaultSort,
  normalizeFilterConfig,
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

interface FilterItem extends FilterItemConfig {
  _id: string;
}

interface PgrestParamItem extends PgrestParam {
  _id: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert a snake_case PGREST key to a human-readable label. */
function humanizeKey(key: string): string {
  return key
    .replace(/^[pv]_/, "")
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Parse a PGREST / dynamic API response into a row array. */
function extractRows(data: unknown): Record<string, string>[] {
  if (Array.isArray(data)) return data as Record<string, string>[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    const candidate = obj.rows ?? obj.data ?? obj.results;
    if (Array.isArray(candidate)) return candidate as Record<string, string>[];
  }
  return [];
}

function toColumnItems(columns: TableColumn[]): ColumnItem[] {
  return columns.map((col, i) => ({ ...col, _id: `col-${i}-${col.key}` }));
}

function fromColumnItems(items: ColumnItem[]): TableColumn[] {
  return items.map(({ key, label, type }) => ({ key, label, type }));
}

function toFilterItems(items: FilterItemConfig[]): FilterItem[] {
  return items.map((item, i) => ({ ...item, _id: `fi-${i}-${item.column}` }));
}

function fromFilterItems(items: FilterItem[]): FilterItemConfig[] {
  return items.map(({ column, label }) => ({ column, label }));
}

function toPgrestParamItems(params: PgrestParam[]): PgrestParamItem[] {
  return params.map((p, i) => ({ ...p, _id: `pp-${i}-${p.key}` }));
}

function fromPgrestParamItems(items: PgrestParamItem[]): PgrestParam[] {
  return items.map(({ key, value }) => ({ key, value }));
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
  const [dataMode, setDataMode] = useState<"static" | "dynamic" | "pgrest">(
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

  // Data provider fields
  const [rowsJson, setRowsJson] = useState(() =>
    JSON.stringify(config.rows ?? defaultRows, null, 2)
  );
  const [rowsJsonError, setRowsJsonError] = useState<string | null>(null);
  const [apiUrl] = useState(config.apiUrl ?? "");
  const [pgrestFunctionName, setPgrestFunctionName] = useState(
    config.pgrestFunctionName ?? ""
  );
  const [pgrestParams, setPgrestParams] = useState<PgrestParamItem[]>(
    toPgrestParamItems(config.pgrestParams ?? [])
  );
  const [pgrestHttpMethod, setPgrestHttpMethod] = useState<PgrestHttpMethod>(
    config.pgrestHttpMethod ?? "POST"
  );

  // Detect-columns state
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Introspect state
  const [introspecting, setIntrospecting] = useState(false);
  const [introspectError, setIntrospectError] = useState<string | null>(null);
  const [paramHints, setParamHints] = useState<Record<string, string>>({});

  const canDetectColumns =
    (dataMode === "pgrest" && pgrestFunctionName.trim() !== "") ||
    (dataMode === "dynamic" && apiUrl.trim() !== "");

  const detectColumns = async () => {
    setDetecting(true);
    setDetectError(null);

    try {
      let fetchUrl: string;
      let fetchInit: RequestInit | undefined;

      if (dataMode === "pgrest") {
        const validParams = pgrestParams.filter((p) => p.key && p.value);
        const baseUrl = `/app/api/dashboard/pgrest/${pgrestFunctionName.trim()}`;

        if (pgrestHttpMethod === "POST") {
          const body: Record<string, string> = {};
          for (const p of validParams) body[p.key] = p.value;
          fetchUrl = baseUrl;
          fetchInit = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          };
        } else {
          const qs = new URLSearchParams();
          for (const p of validParams) qs.set(p.key, p.value);
          const query = qs.toString();
          fetchUrl = query ? `${baseUrl}?${query}` : baseUrl;
        }
      } else {
        fetchUrl = apiUrl.trim();
      }

      const res = await fetch(fetchUrl, fetchInit);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      const rows = extractRows(data);
      if (rows.length === 0) {
        setDetectError("Response returned no rows");
        return;
      }

      const keys = Object.keys(rows[0]);
      const detected: ColumnItem[] = keys.map((key, i) => ({
        _id: `col-${Date.now()}-${i}`,
        key,
        label: humanizeKey(key),
        type: "text" as const,
      }));
      setColumns(detected);

      // Sync filter items to the detected columns
      const detectedKeys = new Set(detected.map((c) => c.key));
      const labelByKey = new Map(detected.map((c) => [c.key, c.label]));
      const firstKey = detected.find((c) => c.key)?.key ?? "";
      setFilterItems((prev) =>
        prev.map((fi) => {
          // If the filter column no longer exists, re-point to the first column
          const column = detectedKeys.has(fi.column) ? fi.column : firstKey;
          return {
            ...fi,
            column,
            label: labelByKey.get(column) ?? fi.label,
          };
        })
      );

      // Remove stale sort columns that no longer exist
      setSortColumns((prev) => prev.filter((k) => detectedKeys.has(k)));
    } catch (err: unknown) {
      setDetectError(err instanceof Error ? err.message : "Detection failed");
    } finally {
      setDetecting(false);
    }
  };

  const introspectFunction = async () => {
    const fn = pgrestFunctionName.trim();
    if (!fn) return;

    setIntrospecting(true);
    setIntrospectError(null);

    try {
      const res = await fetch(
        `/app/api/dashboard/pgrest/openapi?fn=${encodeURIComponent(fn)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
      }

      const data = (await res.json()) as {
        methods: string[];
        parameters: { name: string; type: string; format: string }[];
      };

      // Auto-set HTTP method to first available
      if (data.methods.length > 0) {
        setPgrestHttpMethod(data.methods[0] as PgrestHttpMethod);
      }

      // Replace parameters with introspected ones
      const now = Date.now();
      const newParams: PgrestParamItem[] = data.parameters.map((p, i) => ({
        _id: `pp-${now}-${i}`,
        key: p.name,
        value: "",
      }));
      setPgrestParams(newParams);

      // Store format hints for placeholders
      const hints: Record<string, string> = {};
      for (const p of data.parameters) {
        hints[p.name] = p.format;
      }
      setParamHints(hints);
    } catch (err: unknown) {
      setIntrospectError(
        err instanceof Error ? err.message : "Introspection failed"
      );
    } finally {
      setIntrospecting(false);
    }
  };

  const handleSortColumnToggle = (checked: boolean, key: string) => {
    setSortColumns((prev) =>
      checked ? [...prev, key] : prev.filter((k) => k !== key)
    );
  };

  // ── Column helpers ──────────────────────────────────────────────────────────

  const addColumn = () => {
    setDetectError(null);
    setColumns((prev) => [
      ...prev,
      { _id: `col-${Date.now()}`, key: "", label: "", type: "text" },
    ]);
  };

  const removeColumn = (id: string) => {
    setDetectError(null);
    setColumns((prev) => prev.filter((c) => c._id !== id));
  };

  const updateColumn = (
    id: string,
    field: keyof TableColumn,
    value: string
  ) => {
    setDetectError(null);
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

  // ── PGREST param helpers ──────────────────────────────────────────────────

  const addPgrestParam = () => {
    setIntrospectError(null);
    setPgrestParams((prev) => [
      ...prev,
      { _id: `pp-${Date.now()}`, key: "", value: "" },
    ]);
  };

  const removePgrestParam = (id: string) => {
    setIntrospectError(null);
    setPgrestParams((prev) => prev.filter((p) => p._id !== id));
  };

  const updatePgrestParam = (
    id: string,
    field: keyof PgrestParam,
    value: string
  ) => {
    setIntrospectError(null);
    // Clear hint for this param when its key is manually edited
    if (field === "key") {
      const param = pgrestParams.find((p) => p._id === id);
      if (param && param.key !== value) {
        setParamHints((prev) => {
          const next = { ...prev };
          delete next[param.key];
          return next;
        });
      }
    }
    setPgrestParams((prev) =>
      prev.map((p) => (p._id === id ? { ...p, [field]: value } : p))
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
      items: fromFilterItems(filterItems),
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
      pgrestFunctionName,
      pgrestParams: fromPgrestParamItems(pgrestParams),
      pgrestHttpMethod,
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
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-sm font-medium">Columns</Label>
                  {canDetectColumns && (
                    <Button
                      color="light"
                      size="xs"
                      disabled={detecting}
                      onClick={detectColumns}
                      onMouseDown={handleMouseDown}
                      className="no-drag"
                    >
                      {detecting ? (
                        <Spinner size="xs" className="mr-1" />
                      ) : (
                        <HiMagnifyingGlass className="mr-1 h-3 w-3" />
                      )}
                      Detect columns
                    </Button>
                  )}
                </div>
                {detectError && (
                  <p className="mb-1.5 text-xs text-red-500 dark:text-red-400">
                    {detectError}
                  </p>
                )}
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
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium">
                      Filter rows
                    </Label>
                    <div className="space-y-1.5">
                      {filterItems.map((fi) => (
                        <div key={fi._id} className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <TextInput
                              sizing="sm"
                              placeholder="label"
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
                      Add filter
                    </Button>
                  </div>
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
                onChange={(v) =>
                  setDataMode(v as "static" | "dynamic" | "pgrest")
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
                <>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <Label
                        htmlFor="dt-pgrest-fn"
                        className="text-sm font-medium"
                      >
                        Function name
                      </Label>
                      {pgrestFunctionName.trim() && (
                        <Button
                          color="light"
                          size="xs"
                          disabled={introspecting}
                          onClick={introspectFunction}
                          onMouseDown={handleMouseDown}
                          className="no-drag"
                        >
                          {introspecting ? (
                            <Spinner size="xs" className="mr-1" />
                          ) : (
                            <HiMagnifyingGlass className="mr-1 h-3 w-3" />
                          )}
                          Introspect
                        </Button>
                      )}
                    </div>
                    <TextInput
                      id="dt-pgrest-fn"
                      sizing="sm"
                      value={pgrestFunctionName}
                      onChange={(e) => setPgrestFunctionName(e.target.value)}
                      placeholder="api_modular_my_function"
                    />
                    {introspectError && (
                      <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                        {introspectError}
                      </p>
                    )}
                  </div>
                  <SettingsSelectField
                    id="dt-pgrest-method"
                    label="HTTP Method"
                    value={pgrestHttpMethod}
                    onChange={(v) =>
                      setPgrestHttpMethod(v as PgrestHttpMethod)
                    }
                    options={[
                      { value: "POST", label: "POST" },
                      { value: "GET", label: "GET" },
                    ]}
                  />
                  <div>
                    <Label className="mb-1.5 block text-sm font-medium">
                      Parameters
                    </Label>
                    <div className="space-y-1.5">
                      {pgrestParams.map((p) => (
                        <div key={p._id} className="flex items-center gap-1">
                          <div className="flex-1 min-w-0">
                            <TextInput
                              sizing="sm"
                              placeholder="key"
                              value={p.key}
                              onChange={(e) =>
                                updatePgrestParam(p._id, "key", e.target.value)
                              }
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <TextInput
                              sizing="sm"
                              placeholder={paramHints[p.key] ?? "value"}
                              value={p.value}
                              onChange={(e) =>
                                updatePgrestParam(
                                  p._id,
                                  "value",
                                  e.target.value
                                )
                              }
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removePgrestParam(p._id)}
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
                      onClick={addPgrestParam}
                      onMouseDown={handleMouseDown}
                      className="no-drag mt-2"
                    >
                      <HiPlus className="mr-1 h-3 w-3" />
                      Add parameter
                    </Button>
                  </div>
                </>
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
