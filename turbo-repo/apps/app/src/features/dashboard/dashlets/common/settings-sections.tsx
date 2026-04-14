"use client";

import {
  Button,
  Textarea,
  Label,
  ToggleSwitch,
  TextInput,
  Select,
} from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import type { ColumnItem } from "./column-helpers";
import { DeleteItemButton } from "./delete-item-button";
import type { FilterItem } from "./filter-helpers";
import type { FilterItemConfig } from "./filter-types";
import type { DataMode } from "./column-types";
import { SettingsTextField, SettingsSelectField } from "./settings-fields";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";
import { SuggestionInput } from "./suggestion-input";
import { COLUMN_TYPES } from "./column-types";
import type { ColorRuleItem } from "./color-rule-helpers";
import type { ColorRuleOperator } from "./color-rule-types";
import { COLOR_RULE_PRESETS, COLOR_RULE_OPERATORS } from "./color-rule-types";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import type { ActionItemWithId } from "./action-helpers";
import type { ActionTarget } from "./action-types";
import { RuleRowControls } from "./rule-row-controls";

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
  onUpdate: (
    id: string,
    field: "key" | "label" | "type",
    value: string
  ) => void;
  onAddColorMapping?: (colId: string) => void;
  onRemoveColorMapping?: (colId: string, mappingId: string) => void;
  onUpdateColorMapping?: (
    colId: string,
    mappingId: string,
    field: "operator" | "value" | "color",
    val: string
  ) => void;
  labels: {
    columns: string;
    key: string;
    label: string;
    addColumn: string;
    addMapping: string;
    valuePlaceholder: string;
    operatorLabels: Record<ColorRuleOperator, string>;
  };
  /** When true, apply Handlebars color coding to key and label inputs */
  handlebarsColorKeys?: boolean;
}

export function ColumnEditor({
  columns,
  onAdd,
  onRemove,
  onUpdate,
  onAddColorMapping,
  onRemoveColorMapping,
  onUpdateColorMapping,
  labels,
  handlebarsColorKeys = false,
}: Readonly<ColumnEditorProps>) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm font-medium">
        {labels.columns}
      </Label>
      <div className="space-y-1.5">
        {columns.map((col) => (
          <div key={col._id} className="space-y-1">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1">
                <TextInput
                  sizing="sm"
                  placeholder={labels.key}
                  value={col.key}
                  onChange={(e) => onUpdate(col._id, "key", e.target.value)}
                  color={
                    handlebarsColorKeys
                      ? getFlowbiteColor(getHandlebarsStatus(col.key))
                      : undefined
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                <TextInput
                  sizing="sm"
                  placeholder={labels.label}
                  value={col.label}
                  onChange={(e) => onUpdate(col._id, "label", e.target.value)}
                  color={
                    handlebarsColorKeys
                      ? getFlowbiteColor(getHandlebarsStatus(col.label))
                      : undefined
                  }
                />
              </div>
              <div className="w-28 shrink-0">
                <SuggestionInput
                  sizing="sm"
                  placeholder="text"
                  value={col.type}
                  onChange={(v) => onUpdate(col._id, "type", v)}
                  suggestions={COLUMN_TYPES}
                  color={getFlowbiteColor(getHandlebarsStatus(col.type))}
                />
              </div>
              <DeleteItemButton
                onClick={() => onRemove(col._id)}
                ariaLabel="Delete column"
              />
            </div>

            {/* Inline badge color map */}
            {col.type === "badge" &&
              onAddColorMapping &&
              onRemoveColorMapping &&
              onUpdateColorMapping && (
                <div className="ml-4 space-y-1 border-l-2 border-gray-200 pl-3 dark:border-gray-600">
                  {(col.colorMap ?? []).map((mapping) => (
                    <div
                      key={`${col._id}-cm-${mapping._id}`}
                      className="flex items-center gap-1"
                    >
                      <div className="w-24 shrink-0">
                        <Select
                          sizing="sm"
                          value={mapping.operator}
                          onChange={(e) =>
                            onUpdateColorMapping(
                              col._id,
                              mapping._id!,
                              "operator",
                              e.target.value
                            )
                          }
                          className="[&>select]:cursor-pointer"
                        >
                          {COLOR_RULE_OPERATORS.map((op) => (
                            <option key={op} value={op}>
                              {labels.operatorLabels[op]}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="min-w-0 flex-1">
                        <TextInput
                          sizing="sm"
                          placeholder={labels.valuePlaceholder}
                          value={mapping.value}
                          onChange={(e) =>
                            onUpdateColorMapping(
                              col._id,
                              mapping._id!,
                              "value",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <AdvancedColorPicker
                        value={mapping.color}
                        onChange={(newColor) =>
                          onUpdateColorMapping?.(
                            col._id,
                            mapping._id!,
                            "color",
                            newColor
                          )
                        }
                        presets={COLOR_RULE_PRESETS}
                        title="Select mapping color"
                      />
                      <DeleteItemButton
                        onClick={() =>
                          onRemoveColorMapping(col._id, mapping._id!)
                        }
                        ariaLabel="Delete color mapping"
                      />
                    </div>
                  ))}
                  <Button
                    color="light"
                    size="xs"
                    onClick={() => onAddColorMapping(col._id)}
                    onMouseDown={stopPropagation}
                    className="no-drag"
                  >
                    <HiPlus className="mr-1 h-3 w-3" />
                    {labels.addMapping}
                  </Button>
                </div>
              )}
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
  labels: {
    filter: string;
    filterRows: string;
    label: string;
    addFilter: string;
  };
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
                      className="[&>select]:cursor-pointer"
                    >
                      {columnsWithKeys.map((c) => (
                        <option key={c._id} value={c.key}>
                          {c.label || c.key}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <DeleteItemButton
                    onClick={() => onRemove(fi._id)}
                    ariaLabel="Delete filter"
                  />
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
  dataMode: DataMode;
  onDataModeChange: (mode: DataMode) => void;
  rowsJson: string;
  onRowsJsonChange: (json: string) => void;
  rowsJsonError: string | null;
  onRowsJsonErrorClear: () => void;
  apiUrl: string;
  onApiUrlChange: (url: string) => void;
  /** Content rendered when dataMode === "pgrest" */
  pgrestContent?: React.ReactNode;
  /** Content rendered when dataMode === "planner" */
  plannerContent?: React.ReactNode;
  labels: {
    dataSource: string;
    staticJson: string;
    dynamicApi: string;
    pgrest?: string;
    planner?: string;
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
  pgrestContent,
  plannerContent,
  labels,
}: Readonly<DataProviderTabProps>) {
  const options = [
    { value: "static", label: labels.staticJson },
    { value: "dynamic", label: labels.dynamicApi },
  ];
  if (pgrestContent !== undefined || dataMode === "pgrest") {
    options.push({ value: "pgrest", label: labels.pgrest ?? "PGREST" });
  }
  if (plannerContent !== undefined || dataMode === "planner") {
    options.push({ value: "planner", label: labels.planner ?? "Planner" });
  }

  return (
    <>
      <SettingsSelectField
        id={`${id}-data-mode`}
        label={labels.dataSource}
        value={dataMode}
        onChange={(v) => onDataModeChange(v as DataMode)}
        options={options}
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

      {dataMode === "pgrest" && pgrestContent}

      {dataMode === "planner" && plannerContent}
    </>
  );
}

// ============================================================================
// ColorRuleEditor
// ============================================================================

interface ColorRuleEditorProps {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  rules: ColorRuleItem[];
  columnsWithKeys: ColumnItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  labels: {
    addRule: string;
    valuePlaceholder: string;
    operatorLabels: Record<ColorRuleOperator, string>;
  };
}

export function ColorRuleEditor({
  title,
  enabled,
  onToggle,
  rules,
  columnsWithKeys,
  onAdd,
  onRemove,
  onUpdate,
  labels,
}: Readonly<ColorRuleEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{title}</Label>
          <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
        </div>

        {enabled && (
          <div>
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule._id} className="flex items-center gap-1">
                  {/* Column select */}
                  <div className="min-w-0 flex-1">
                    <Select
                      sizing="sm"
                      value={rule.column}
                      onChange={(e) =>
                        onUpdate(rule._id, "column", e.target.value)
                      }
                      className="[&>select]:cursor-pointer"
                    >
                      {columnsWithKeys.map((c) => (
                        <option key={c._id} value={c.key}>
                          {c.label || c.key}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <RuleRowControls
                    ruleId={rule._id}
                    operator={rule.operator}
                    value={rule.value}
                    color={rule.color}
                    onUpdate={onUpdate}
                    onRemove={onRemove}
                    operatorLabels={labels.operatorLabels}
                    valuePlaceholder={labels.valuePlaceholder}
                  />
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
              {labels.addRule}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// ActionsEditor
// ============================================================================

interface ActionsEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  items: ActionItemWithId[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (
    id: string,
    field: "name" | "link" | "target",
    value: string
  ) => void;
  labels: {
    actions: string;
    addAction: string;
    actionName: string;
    actionLink: string;
    actionTarget: string;
    actionTargetSelf: string;
    actionTargetBlank: string;
  };
}

export function ActionsEditor({
  enabled,
  onToggle,
  items,
  onAdd,
  onRemove,
  onUpdate,
  labels,
}: Readonly<ActionsEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">{labels.actions}</Label>
          <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
        </div>

        {enabled && (
          <div>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="space-y-1 rounded-lg border border-gray-200 p-2 dark:border-gray-600"
                >
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <TextInput
                        sizing="sm"
                        placeholder={labels.actionName}
                        value={item.name}
                        onChange={(e) =>
                          onUpdate(item._id, "name", e.target.value)
                        }
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <Select
                        sizing="sm"
                        aria-label={labels.actionTarget}
                        value={item.target}
                        onChange={(e) =>
                          onUpdate(
                            item._id,
                            "target",
                            e.target.value as ActionTarget
                          )
                        }
                        className="[&>select]:cursor-pointer"
                      >
                        <option value="_blank">
                          {labels.actionTargetBlank}
                        </option>
                        <option value="_self">{labels.actionTargetSelf}</option>
                      </Select>
                    </div>
                    <DeleteItemButton
                      onClick={() => onRemove(item._id)}
                      ariaLabel="Delete action"
                    />
                  </div>
                  <div>
                    <TextInput
                      sizing="sm"
                      placeholder={labels.actionLink}
                      value={item.link}
                      onChange={(e) =>
                        onUpdate(item._id, "link", e.target.value)
                      }
                      color={getFlowbiteColor(getHandlebarsStatus(item.link))}
                    />
                  </div>
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
              {labels.addAction}
            </Button>
          </div>
        )}
      </div>
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
          <label key={c._id} className="flex cursor-pointer items-center gap-2">
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
