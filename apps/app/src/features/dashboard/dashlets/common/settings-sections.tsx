"use client";

import {
  Button,
  TextInput,
  Textarea,
  Label,
  ToggleSwitch,
  Select,
} from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { ColumnItem } from "./column-helpers";
import type { FilterItem } from "./filter-helpers";
import type { FilterItemConfig } from "./filter-types";
import { SettingsTextField, SettingsSelectField } from "./settings-fields";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";

// ============================================================================
// Shared mouse-down handler (prevents drag on settings modals)
// ============================================================================

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

// ============================================================================
// ColumnEditor
// ============================================================================

interface ColumnEditorProps {
  columns: ColumnItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: "key" | "label" | "type", value: string) => void;
  labels: { columns: string; key: string; label: string; addColumn: string };
}

export function ColumnEditor({
  columns,
  onAdd,
  onRemove,
  onUpdate,
  labels,
}: Readonly<ColumnEditorProps>) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">
        {labels.columns}
      </Label>
      <div className="space-y-1.5">
        {columns.map((col) => (
          <div key={col._id} className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <TextInput
                sizing="sm"
                placeholder={labels.key}
                value={col.key}
                onChange={(e) => onUpdate(col._id, "key", e.target.value)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <TextInput
                sizing="sm"
                placeholder={labels.label}
                value={col.label}
                onChange={(e) => onUpdate(col._id, "label", e.target.value)}
              />
            </div>
            <div className="w-28 shrink-0">
              <TextInput
                sizing="sm"
                placeholder="text"
                value={col.type}
                onChange={(e) =>
                  onUpdate(col._id, "type", e.target.value)
                }
                color={getFlowbiteColor(getHandlebarsStatus(col.type))}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(col._id)}
              onMouseDown={stopPropagation}
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
        onClick={onAdd}
        onMouseDown={stopPropagation}
        className="no-drag mt-2"
      >
        <HiPlus className="mr-1 h-3 w-3" />
        {labels.addColumn}
      </Button>
    </div>
  );
}

// ============================================================================
// FilterEditor
// ============================================================================

interface FilterEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  items: FilterItem[];
  columnsWithKeys: ColumnItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof FilterItemConfig, value: string) => void;
  labels: { filter: string; filterRows: string; label: string; addFilter: string };
}

export function FilterEditor({
  enabled,
  onToggle,
  items,
  columnsWithKeys,
  onAdd,
  onRemove,
  onUpdate,
  labels,
}: Readonly<FilterEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{labels.filter}</Label>
          <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
        </div>

        {enabled && (
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              {labels.filterRows}
            </Label>
            <div className="space-y-1.5">
              {items.map((fi) => (
                <div key={fi._id} className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <TextInput
                      sizing="sm"
                      placeholder={labels.label}
                      value={fi.label}
                      onChange={(e) =>
                        onUpdate(fi._id, "label", e.target.value)
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Select
                      sizing="sm"
                      value={fi.column}
                      onChange={(e) =>
                        onUpdate(fi._id, "column", e.target.value)
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
                    onClick={() => onRemove(fi._id)}
                    onMouseDown={stopPropagation}
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
              onClick={onAdd}
              onMouseDown={stopPropagation}
              className="no-drag mt-2"
            >
              <HiPlus className="mr-1 h-3 w-3" />
              {labels.addFilter}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// SortEditor
// ============================================================================

interface SortEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  sortColumns: string[];
  columnsWithKeys: ColumnItem[];
  onColumnToggle: (checked: boolean, key: string) => void;
  labels: { sort: string; sortableColumns: string };
}

export function SortEditor({
  enabled,
  onToggle,
  sortColumns,
  columnsWithKeys,
  onColumnToggle,
  labels,
}: Readonly<SortEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{labels.sort}</Label>
          <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
        </div>

        {enabled && (
          <div>
            <Label className="mb-1.5 block text-sm font-medium">
              {labels.sortableColumns}
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
                    onChange={(e) => onColumnToggle(e.target.checked, c.key)}
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
  );
}

// ============================================================================
// DataProviderTab
// ============================================================================

interface DataProviderTabProps {
  id: string;
  dataMode: "static" | "dynamic";
  onDataModeChange: (mode: "static" | "dynamic") => void;
  rowsJson: string;
  onRowsJsonChange: (json: string) => void;
  rowsJsonError: string | null;
  onRowsJsonErrorClear: () => void;
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  labels: {
    dataSource: string;
    staticJson: string;
    dynamicApi: string;
    rowsJsonArray: string;
    apiUrl: string;
  };
}

export function DataProviderTab({
  id,
  dataMode,
  onDataModeChange,
  rowsJson,
  onRowsJsonChange,
  rowsJsonError,
  onRowsJsonErrorClear,
  apiUrl,
  onApiUrlChange,
  labels,
}: Readonly<DataProviderTabProps>) {
  return (
    <>
      <SettingsSelectField
        id={`${id}-data-mode`}
        label={labels.dataSource}
        value={dataMode}
        onChange={(v) => onDataModeChange(v as "static" | "dynamic")}
        options={[
          { value: "static", label: labels.staticJson },
          { value: "dynamic", label: labels.dynamicApi },
        ]}
      />

      {dataMode === "static" && (
        <div>
          <Label
            htmlFor={`${id}-rows-json`}
            className="mb-1 block text-sm font-medium"
          >
            {labels.rowsJsonArray}
          </Label>
          <Textarea
            id={`${id}-rows-json`}
            value={rowsJson}
            onChange={(e) => {
              onRowsJsonChange(e.target.value);
              onRowsJsonErrorClear();
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

      {dataMode === "dynamic" && (
        <SettingsTextField
          id={`${id}-api-url`}
          label={labels.apiUrl}
          value={apiUrl}
          onChange={onApiUrlChange}
        />
      )}
    </>
  );
}

// ============================================================================
// CheckboxColumnList — reusable checkbox list for column selection
// ============================================================================

interface CheckboxColumnListProps {
  label: string;
  columnsWithKeys: ColumnItem[];
  selected: string[];
  onToggle: (checked: boolean, key: string) => void;
}

export function CheckboxColumnList({
  label,
  columnsWithKeys,
  selected,
  onToggle,
}: Readonly<CheckboxColumnListProps>) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">{label}</Label>
      <div className="space-y-1">
        {columnsWithKeys.map((c) => (
          <label
            key={c._id}
            className="flex cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={selected.includes(c.key)}
              onChange={(e) => onToggle(e.target.checked, c.key)}
              className="no-drag h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {c.label || c.key}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
