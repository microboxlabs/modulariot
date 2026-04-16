"use client";

import {
  Button,
  Label,
  Dropdown,
  DropdownItem,
  ToggleSwitch,
} from "flowbite-react";
import { HiPlus, HiChevronDown } from "react-icons/hi2";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ColorRuleOperator } from "./color-rule-types";
import { ColorRuleRow, DEFAULT_COLOR_PRESETS } from "./color-rule-row";

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
                  valuePlaceholder={tr("dashboard.settings.value", dictionary)}
                  colorPresets={DEFAULT_COLOR_PRESETS}
                  colorPickerTitle={tr(
                    "dashboard.settings.selectRuleColor",
                    dictionary
                  )}
                  deleteAriaLabel={tr("common.delete", dictionary)}
                  valueInputClassName="w-20 shrink-0"
                  prefixElement={
                    <Dropdown
                      label=""
                      dismissOnClick
                      renderTrigger={() => (
                        <button
                          type="button"
                          className="flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                        >
                          <span className="truncate">
                            {columns.find((c) => c.key === rule.column)
                              ?.label || rule.column}
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
                  }
                />
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
