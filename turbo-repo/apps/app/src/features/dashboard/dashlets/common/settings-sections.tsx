"use client";

import React, { useRef, useState } from "react";
import { Textarea, Label, TextInput, Select, Dropdown, DropdownItem, Button } from "flowbite-react";
import {
  HiChevronDown,
  HiPaintBrush,
  HiQuestionMarkCircle,
  HiBars3,
} from "react-icons/hi2";
import { ReactSortable } from "react-sortablejs";
import type { ColumnItem } from "./column-helpers";
import { DeleteItemButton } from "./delete-item-button";
import type { FilterItem } from "./filter-helpers";
import type { FilterItemConfig } from "./filter-types";
import type { DataMode } from "./column-types";
import { SettingsTextField, SettingsSelectField } from "./settings-fields";
import { getHandlebarsStatus, getFlowbiteColor } from "./handlebars-helpers";
import { SuggestionInput } from "./suggestion-input";
import { COLUMN_TYPES, DATA_TYPES } from "./column-types";
import type { ColorRuleItem } from "./color-rule-helpers";
import type { ColorRuleOperator } from "./color-rule-types";
import { COLOR_RULE_PRESETS } from "./color-rule-types";
import {
  ColorRuleRow,
  ToggleSectionHeader,
  AddRuleButton,
  ColumnDropdown,
} from "./color-rule-row";
import type { ActionItemWithId, RowActionItemWithId } from "./action-helpers";
import type { ActionTarget } from "./action-types";

// ============================================================================
// ColumnEditor
// ============================================================================

/** ColumnItem extended with `id` for react-sortablejs compatibility. */
interface SortableColumnItem extends ColumnItem {
  id: string;
}

interface ColumnEditorProps {
  columns: ColumnItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (reordered: ColumnItem[]) => void;
  onUpdate: (
    id: string,
    field:
      | "key"
      | "label"
      | "type"
      | "dataType"
      | "sticky"
      | "descriptionEnabled"
      | "description"
      | "colorRulesEnabled"
      | "decorator",
    value: string | boolean | undefined
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
    stickyColumn: string;
    rulesLabel: string;
    valuePlaceholder: string;
    operatorLabels: Record<ColorRuleOperator, string>;
    decoratorPlaceholder?: string;
  };
  /** When true, apply Handlebars color coding to key and label inputs */
  handlebarsColorKeys?: boolean;
}

export function ColumnEditor({
  columns,
  onAdd,
  onRemove,
  onReorder,
  onUpdate,
  onAddColorMapping,
  onRemoveColorMapping,
  onUpdateColorMapping,
  labels,
  handlebarsColorKeys = false,
}: Readonly<ColumnEditorProps>) {
  const sortableColumns: SortableColumnItem[] = columns.map((col) => ({
    ...col,
    id: col._id,
  }));

  function handleReorder(newList: SortableColumnItem[]) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onReorder(newList.map(({ id, ...rest }) => rest));
  }

  return (
    <div>
      <ReactSortable
        list={sortableColumns}
        setList={handleReorder}
        animation={150}
        handle=".drag-handle"
        className="space-y-2"
      >
        {sortableColumns.map((col, idx) => {
          const prevSticky = !!sortableColumns[idx - 1]?.sticky;
          const nextSticky = !!sortableColumns[idx + 1]?.sticky;
          const connectedLeft = idx === 0 || prevSticky;
          const connectedRight =
            idx === sortableColumns.length - 1 || nextSticky;
          const canEnableSticky = connectedLeft || connectedRight;
          const canDisableSticky = !col.sticky || !(prevSticky && nextSticky);
          return (
            <ColumnCard
              key={col._id}
              col={col}
              canBeSticky={canEnableSticky}
              canDisableSticky={canDisableSticky}
              onUpdate={onUpdate}
              onRemove={onRemove}
              onAddColorMapping={onAddColorMapping}
              onRemoveColorMapping={onRemoveColorMapping}
              onUpdateColorMapping={onUpdateColorMapping}
              labels={labels}
              handlebarsColorKeys={handlebarsColorKeys}
            />
          );
        })}
      </ReactSortable>
      <AddRuleButton
        onClick={onAdd}
        label={labels.addColumn}
        className="mt-2"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// ColumnCard (extracted to avoid nested component definitions)
// ----------------------------------------------------------------------------

interface ColumnCardProps {
  col: SortableColumnItem;
  canBeSticky: boolean;
  /** Whether this column can be un-stuck (false for interior sticky columns). */
  canDisableSticky: boolean;
  onUpdate: ColumnEditorProps["onUpdate"];
  onRemove: (id: string) => void;
  onAddColorMapping?: ColumnEditorProps["onAddColorMapping"];
  onRemoveColorMapping?: ColumnEditorProps["onRemoveColorMapping"];
  onUpdateColorMapping?: ColumnEditorProps["onUpdateColorMapping"];
  labels: ColumnEditorProps["labels"];
  handlebarsColorKeys: boolean;
}

function getStickyBtnClass(disabled: boolean, active: boolean): string {
  if (disabled) return "cursor-not-allowed text-gray-300 dark:text-gray-600";
  if (active) return "text-blue-600 dark:text-blue-400";
  return "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300";
}

function ColumnCard({
  col,
  canBeSticky,
  canDisableSticky,
  onUpdate,
  onRemove,
  onAddColorMapping,
  onRemoveColorMapping,
  onUpdateColorMapping,
  labels,
  handlebarsColorKeys,
}: Readonly<ColumnCardProps>) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const descEnabled = !!col.descriptionEnabled;
  const colorRulesEnabled = !!col.colorRulesEnabled;
  const hasColorCallbacks = !!onAddColorMapping && !!onRemoveColorMapping && !!onUpdateColorMapping;
  const rulesCount = (col.colorMap ?? []).length;
  const stickyDisabled = col.sticky ? !canDisableSticky : !canBeSticky;

  const headerButtons = (
    <>
      <button
        type="button"
        title="Description"
        onClick={() => onUpdate(col._id, "descriptionEnabled", !descEnabled)}
        className={`shrink-0 rounded p-1 transition-colors ${descEnabled ? "text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"}`}
      >
        <HiQuestionMarkCircle className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={labels.rulesLabel}
        onClick={() => onUpdate(col._id, "colorRulesEnabled", !colorRulesEnabled)}
        className={`shrink-0 rounded p-1 transition-colors ${colorRulesEnabled ? "text-blue-600 dark:text-blue-400" : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"}`}
      >
        <HiPaintBrush className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={labels.stickyColumn}
        disabled={stickyDisabled}
        onClick={() => onUpdate(col._id, "sticky", !col.sticky)}
        className={`shrink-0 rounded p-1 transition-colors ${getStickyBtnClass(stickyDisabled, !!col.sticky)}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path fillRule="evenodd" d="M8.074.945A4.993 4.993 0 0 0 6 5v.032c.004.6.114 1.176.311 1.709.16.428-.204.857-.664.857H2.5c-.88 0-1.601.696-1.497 1.572C1.32 11.8 3.276 14 8 14c4.724 0 6.68-2.2 6.997-4.83.104-.876-.617-1.572-1.497-1.572h-3.147c-.46 0-.824-.43-.664-.857.197-.533.307-1.11.311-1.709V5a4.993 4.993 0 0 0-1.926-4.055Z" clipRule="evenodd" />
        </svg>
      </button>
    </>
  );

  return (
    <SettingsCard
      title={col.label}
      titlePlaceholder={col.key || labels.label}
      onTitleChange={(v) => onUpdate(col._id, "label", v)}
      dragHandleClass="drag-handle"
      onRemove={() => onRemove(col._id)}
      headerButtons={headerButtons}
    >
      <div className="space-y-1.5">
        <div className="min-w-0">
          <TextInput
            sizing="sm"
            placeholder={labels.key}
            value={col.key}
            onChange={(e) => onUpdate(col._id, "key", e.target.value)}
            color={handlebarsColorKeys ? getFlowbiteColor(getHandlebarsStatus(col.key)) : undefined}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1">
            <SuggestionInput
              sizing="sm"
              placeholder="text"
              value={col.type}
              onChange={(v) => onUpdate(col._id, "type", v)}
              suggestions={COLUMN_TYPES}
              color={getFlowbiteColor(getHandlebarsStatus(col.type))}
            />
          </div>
          <div className="min-w-0 flex-1">
            <SuggestionInput
              sizing="sm"
              placeholder="text"
              value={col.dataType ?? "text"}
              onChange={(v) => onUpdate(col._id, "dataType", v)}
              suggestions={DATA_TYPES}
            />
          </div>
        </div>

        <TextInput
          sizing="sm"
          placeholder={labels.decoratorPlaceholder ?? "Suffix (e.g. Days, km, %)"}
          value={col.decorator ?? ""}
          onChange={(e) => onUpdate(col._id, "decorator", e.target.value)}
        />

        {descEnabled && (
          <Textarea
            rows={3}
            className="text-sm"
            placeholder="Column description (markdown supported)"
            value={col.description ?? ""}
            onChange={(e) => onUpdate(col._id, "description", e.target.value)}
          />
        )}

        {colorRulesEnabled && hasColorCallbacks && (
          <div className="border-t border-gray-200 pt-1.5 dark:border-gray-600">
            <button
              type="button"
              onClick={() => setRulesOpen(!rulesOpen)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <HiChevronDown className={`h-3.5 w-3.5 transition-transform ${rulesOpen ? "" : "-rotate-90"}`} />
              {labels.rulesLabel}
              {rulesCount > 0 && (
                <span className="ml-1 rounded-full bg-gray-200 px-1.5 text-[10px] font-medium text-gray-600 dark:bg-gray-600 dark:text-gray-300">
                  {rulesCount}
                </span>
              )}
            </button>
            {rulesOpen && (
              <div className="mt-1.5 space-y-1.5 border-l-2 border-gray-200 pl-3 dark:border-gray-600">
                {(col.colorMap ?? []).map((mapping) => (
                  <ColorRuleRow
                    key={`${col._id}-cm-${mapping._id}`}
                    operator={mapping.operator}
                    value={mapping.value}
                    color={mapping.color}
                    onOperatorChange={(op: ColorRuleOperator) => onUpdateColorMapping(col._id, mapping._id!, "operator", op)}
                    onValueChange={(val: string) => onUpdateColorMapping(col._id, mapping._id!, "value", val)}
                    onColorChange={(c: string) => onUpdateColorMapping(col._id, mapping._id!, "color", c)}
                    onDelete={() => onRemoveColorMapping(col._id, mapping._id!)}
                    valuePlaceholder={labels.valuePlaceholder}
                    colorPresets={COLOR_RULE_PRESETS}
                    colorPickerTitle="Select mapping color"
                    deleteAriaLabel="Delete color mapping"
                  />
                ))}
                <AddRuleButton onClick={() => onAddColorMapping(col._id)} label={labels.addMapping} />
              </div>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
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
    <div className="space-y-2">
        <ToggleSectionHeader
          label={labels.filter}
          enabled={enabled}
          onToggle={onToggle}
        />

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
            <AddRuleButton
              onClick={onAdd}
              label={labels.addFilter}
              className="mt-2"
            />
          </div>
        )}
    </div>
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
    <div className="space-y-2">
      <ToggleSectionHeader
        label={labels.sort}
        enabled={enabled}
        onToggle={onToggle}
      />
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
  const columnOptions = columnsWithKeys.map((c) => ({
    key: c.key,
    label: c.label || c.key,
  }));

  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <ToggleSectionHeader
          label={title}
          enabled={enabled}
          onToggle={onToggle}
        />

        {enabled && (
          <div>
            <div className="space-y-2">
              {rules.map((rule) => (
                <ColorRuleRow
                  key={rule._id}
                  operator={rule.operator}
                  value={rule.value}
                  color={rule.color}
                  onOperatorChange={(op: ColorRuleOperator) =>
                    onUpdate(rule._id, "operator", op)
                  }
                  onValueChange={(val: string) =>
                    onUpdate(rule._id, "value", val)
                  }
                  onColorChange={(c: string) => onUpdate(rule._id, "color", c)}
                  onDelete={() => onRemove(rule._id)}
                  valuePlaceholder={labels.valuePlaceholder}
                  colorPresets={COLOR_RULE_PRESETS}
                  valueInputClassName="w-20 shrink-0"
                  prefixElement={
                    <ColumnDropdown
                      value={rule.column ?? ""}
                      options={columnOptions}
                      onChange={(key) => onUpdate(rule._id, "column", key)}
                    />
                  }
                />
              ))}
            </div>
            <AddRuleButton
              onClick={onAdd}
              label={labels.addRule}
              className="mt-2"
            />
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// ActionsEditor
// ============================================================================

type ActionField = "name" | "link" | "target";

interface ActionsEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  items: ActionItemWithId[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (
    id: string,
    field: ActionField,
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
    <div className="space-y-2">
      <ToggleSectionHeader
        label={labels.actions}
        enabled={enabled}
        onToggle={onToggle}
      />
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
          <AddRuleButton
            onClick={onAdd}
            label={labels.addAction}
            className="mt-2"
          />
        </div>
      )}
    </div>
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

// ============================================================================
// RowActionsEditor
// ============================================================================

interface SortableRowActionItem extends RowActionItemWithId {
  id: string;
}

interface RowActionsEditorLabels {
  addAction: string;
  actionName: string;
  actionLink: string;
  sameTab: string;
  newTab: string;
  primarySection: string;
  secondarySection: string;
  dragActionHere?: string;
}

interface RowActionsEditorProps {
  items: RowActionItemWithId[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onReorder: (items: RowActionItemWithId[]) => void;
  onUpdate: (id: string, field: "name" | "link" | "target", value: string) => void;
  labels: RowActionsEditorLabels;
}

// ----------------------------------------------------------------------------
// SettingsCard — generic card with drag handle, click-to-edit title, delete
// ----------------------------------------------------------------------------

interface SettingsCardProps {
  title: string;
  titlePlaceholder?: string;
  onTitleChange: (value: string) => void;
  dragHandleClass: string;
  onRemove: () => void;
  headerButtons?: React.ReactNode;
  children?: React.ReactNode;
  reorderAriaLabel?: string;
  deleteAriaLabel?: string;
}

function SettingsCard({
  title,
  titlePlaceholder,
  onTitleChange,
  dragHandleClass,
  onRemove,
  headerButtons,
  children,
  reorderAriaLabel = "Reorder",
  deleteAriaLabel = "Delete",
}: Readonly<SettingsCardProps>) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function stopEdit() {
    setEditing(false);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-2 py-1.5 dark:border-gray-600">
        <button
          type="button"
          className={`${dragHandleClass} shrink-0 cursor-grab p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing dark:text-gray-500 dark:hover:text-gray-300`}
          aria-label={reorderAriaLabel}
        >
          <HiBars3 className="h-3.5 w-3.5" />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={title}
            placeholder={titlePlaceholder}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={stopEdit}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") stopEdit(); }}
            className="min-w-0 flex-1 rounded border border-blue-400 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-900 outline-none dark:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="min-w-0 flex-1 truncate text-left text-xs font-medium text-gray-700 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400"
          >
            {title || <span className="text-gray-400 dark:text-gray-500">{titlePlaceholder}</span>}
          </button>
        )}

        {headerButtons}

        <DeleteItemButton onClick={onRemove} ariaLabel={deleteAriaLabel} />
      </div>

      {/* Body */}
      {children && <div className="p-2">{children}</div>}
    </div>
  );
}

// ----------------------------------------------------------------------------
// RowActionCard
// ----------------------------------------------------------------------------

function RowActionCard({
  item,
  onRemove,
  onUpdate,
  labels,
}: Readonly<{
  item: SortableRowActionItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: "name" | "link" | "target", value: string) => void;
  labels: Pick<RowActionsEditorLabels, "actionName" | "actionLink" | "sameTab" | "newTab">;
}>) {
  const selectorTheme = {
    floating: {
      base: "overflow-hidden rounded-lg z-10",
      style: {
        auto: "border border-gray-200 dark:border-gray-500 bg-white text-gray-900 dark:bg-gray-700 dark:text-white",
      },
    },
  };

  const methodDropdown = (
    <Dropdown label="" 
      theme={selectorTheme}
      renderTrigger={() => (
        <button
          type="button"
          className="flex items-center gap-1 py-1 px-3 rounded-full border border-gray-200 bg-white text-xs font-light text-gray-900 hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          <span>{item.method ?? "goto"}</span>
          <HiChevronDown className="h-3 w-3" />
        </button>
      )}
    >
      <DropdownItem>goto</DropdownItem>
    </Dropdown>
  );

  return (
    <SettingsCard
      title={item.name}
      titlePlaceholder={labels.actionName}
      onTitleChange={(v) => onUpdate(item._id, "name", v)}
      dragHandleClass="ra-drag-handle"
      onRemove={() => onRemove(item._id)}
      headerButtons={methodDropdown}
    >
      <div className="flex items-center gap-1.5">
        <Dropdown
          label=""
          theme={selectorTheme}
          renderTrigger={() => (
            <Button
              type="button"
              className="flex items-center gap-1.5 h-8 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-light text-gray-900 hover:bg-gray-50 dark:border-gray-500 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <span className="whitespace-nowrap">{item.target === "_blank" ? labels.newTab : labels.sameTab}</span>
              <HiChevronDown className="h-4 w-4 shrink-0" />
            </Button>
          )}
          >
          <DropdownItem onClick={() => onUpdate(item._id, "target", "_self")}>
            {labels.sameTab}
          </DropdownItem>
          <DropdownItem onClick={() => onUpdate(item._id, "target", "_blank")}>
            {labels.newTab}
          </DropdownItem>
        </Dropdown>
        <div className="min-w-0 flex-1">
          <TextInput
            sizing="sm"
            placeholder={labels.actionLink}
            value={item.link}
            onChange={(e) => onUpdate(item._id, "link", e.target.value)}
            color={getFlowbiteColor(getHandlebarsStatus(item.link))}
          />
        </div>
      </div>
    </SettingsCard>
  );
}

export function RowActionsEditor({
  items,
  onAdd,
  onRemove,
  onReorder,
  onUpdate,
  labels,
}: Readonly<RowActionsEditorProps>) {
  const toSortable = (arr: RowActionItemWithId[]): SortableRowActionItem[] =>
    arr.map((x) => ({ ...x, id: x._id }));
  const strip = (arr: SortableRowActionItem[]): RowActionItemWithId[] =>
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    arr.map(({ id, ...rest }) => rest);

  // Derive directly from props — no internal state needed
  const primaryList = toSortable(items.slice(0, 1));
  const secondaryList = toSortable(items.slice(1));

  // Refs updated every render so cross-list DnD callbacks always read latest values
  const primaryRef = useRef(primaryList);
  const secondaryRef = useRef(secondaryList);
  primaryRef.current = primaryList;
  secondaryRef.current = secondaryList;

  function handlePrimary(next: SortableRowActionItem[]) {
    primaryRef.current = next;
    onReorder(strip([...next, ...secondaryRef.current]));
  }

  function handleSecondary(next: SortableRowActionItem[]) {
    secondaryRef.current = next;
    onReorder(strip([...primaryRef.current, ...next]));
  }

  const primarySectionLabel = "text-[10px] font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400 mb-1.5";
  const secondarySectionLabel = "text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1.5";
  const GROUP = "row-actions-dnd";

  const hasAny = primaryList.length > 0 || secondaryList.length > 0;

  return (
    <div className="space-y-3">
      {hasAny && (
        <>
          {/* Primary action */}
          <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2 dark:border-blue-800/50 dark:bg-blue-900/10">
            <p className={primarySectionLabel}>{labels.primarySection}</p>
            <ReactSortable
              group={GROUP}
              list={primaryList}
              setList={handlePrimary}
              animation={150}
              handle=".ra-drag-handle"
              className="space-y-2 min-h-1"
            >
              {primaryList.map((item) => (
                <RowActionCard
                  key={item._id}
                  item={item}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                  labels={labels}
                />
              ))}
            </ReactSortable>
            {primaryList.length === 0 && (
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {labels.dragActionHere ?? "Drag an action here"}
              </p>
            )}
          </div>

          {/* Secondary actions — hidden when empty but kept in DOM for cross-list DnD */}
          <div className={secondaryList.length === 0 ? "hidden" : "rounded-lg border border-gray-200 bg-gray-50/60 p-2 dark:border-gray-600 dark:bg-gray-700/20"}>
            <p className={secondarySectionLabel}>{labels.secondarySection}</p>
            <ReactSortable
              group={GROUP}
              list={secondaryList}
              setList={handleSecondary}
              animation={150}
              handle=".ra-drag-handle"
              className="space-y-2 min-h-1"
            >
              {secondaryList.map((item) => (
                <RowActionCard
                  key={item._id}
                  item={item}
                  onRemove={onRemove}
                  onUpdate={onUpdate}
                  labels={labels}
                />
              ))}
            </ReactSortable>
          </div>
        </>
      )}

      {/* General add button */}
      <AddRuleButton onClick={onAdd} label={labels.addAction} className="mt-0" />
    </div>
  );
}
