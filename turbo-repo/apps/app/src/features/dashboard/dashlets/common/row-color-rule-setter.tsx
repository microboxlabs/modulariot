"use client";

import { Button, Label, Dropdown, DropdownItem, ToggleSwitch } from "flowbite-react";
import { HiPlus, HiTrash, HiChevronDown } from "react-icons/hi2";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import type { PresetColor } from "@/features/common/components/advanced-color-picker";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ColorRuleOperator } from "./color-rule-types";
import { COLOR_RULE_OPERATORS, OPERATOR_LABELS } from "./color-rule-types";

// ============================================================================
// Types
// ============================================================================

/** Column option for dropdown */
export interface ColumnOption {
  key: string;
  label: string;
}

/** A row color rule with column reference */
export interface RowColorRuleItem {
  _id: string;
  /** Column key (Handlebars template, e.g. "{{row.status}}") */
  column: string;
  /** Comparison operator */
  operator: ColorRuleOperator;
  /** Value to compare against */
  value: string;
  /** The color to apply (hex without #) */
  color: string;
}

// ============================================================================
// Constants
// ============================================================================

const COLOR_RULE_PRESETS: PresetColor[] = [
  { value: "ef4444", label: "Red" },
  { value: "f97316", label: "Orange" },
  { value: "eab308", label: "Yellow" },
  { value: "22c55e", label: "Green" },
  { value: "3b82f6", label: "Blue" },
  { value: "8b5cf6", label: "Purple" },
  { value: "6b7280", label: "Gray" },
];

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

// ============================================================================
// Component
// ============================================================================

export interface RowColorRuleSetterProps {
  /** Section title */
  title: string;
  /** Whether color rules are enabled */
  enabled: boolean;
  /** Toggle enabled state */
  onToggle: (enabled: boolean) => void;
  /** The rules to display */
  rules: RowColorRuleItem[];
  /** Available columns for the dropdown */
  columns: ColumnOption[];
  /** i18n dictionary */
  dictionary: I18nRecord;
  /** Callback when add rule button is clicked */
  onAdd: () => void;
  /** Callback when remove button is clicked */
  onRemove: (id: string) => void;
  /** Callback when a rule field is updated */
  onUpdate: (id: string, field: string, value: string) => void;
}

export function RowColorRuleSetter({
  title,
  enabled,
  onToggle,
  rules,
  columns,
  dictionary,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<RowColorRuleSetterProps>) {
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
                <div
                  key={rule._id}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1.5 dark:border-gray-600 dark:bg-gray-700/50"
                >
                  {/* Column selector */}
                  <Dropdown
                    label=""
                    dismissOnClick
                    renderTrigger={() => (
                      <button
                        type="button"
                        className="flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                      >
                        <span className="truncate">
                          {columns.find((c) => c.key === rule.column)?.label ||
                            rule.column}
                        </span>
                        <HiChevronDown className="h-3 w-3 shrink-0" />
                      </button>
                    )}
                  >
                    {columns.map((col) => (
                      <DropdownItem
                        key={col.key}
                        onClick={() => onUpdate(rule._id, "column", col.key)}
                        className="text-xs"
                      >
                        {col.label || col.key}
                      </DropdownItem>
                    ))}
                  </Dropdown>

                  {/* Operator */}
                  <Dropdown
                    label=""
                    dismissOnClick
                    renderTrigger={() => (
                      <button
                        type="button"
                        className="flex h-7 w-16 shrink-0 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                      >
                        <span className="truncate">
                          {OPERATOR_LABELS[rule.operator]}
                        </span>
                        <HiChevronDown className="h-3 w-3 shrink-0" />
                      </button>
                    )}
                  >
                    {COLOR_RULE_OPERATORS.map((op) => (
                      <DropdownItem
                        key={op}
                        onClick={() => onUpdate(rule._id, "operator", op)}
                        className="text-xs"
                      >
                        {OPERATOR_LABELS[op]}
                      </DropdownItem>
                    ))}
                  </Dropdown>

                  {/* Value input */}
                  <input
                    type="text"
                    className="no-drag h-7 w-20 shrink-0 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder={tr("dashboard.settings.value", dictionary)}
                    value={rule.value}
                    onChange={(e) =>
                      onUpdate(rule._id, "value", e.target.value)
                    }
                  />

                  {/* Color picker */}
                  <AdvancedColorPicker
                    value={rule.color}
                    onChange={(c) => onUpdate(rule._id, "color", c)}
                    presets={COLOR_RULE_PRESETS}
                    title={tr("dashboard.settings.selectRuleColor", dictionary)}
                  />

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => onRemove(rule._id)}
                    onMouseDown={stopPropagation}
                    className="no-drag flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    aria-label={tr("common.delete", dictionary)}
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
              {tr("dashboard.settings.addRule", dictionary)}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
