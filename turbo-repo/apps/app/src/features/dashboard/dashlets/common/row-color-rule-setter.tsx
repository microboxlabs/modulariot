"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import type { ColorRuleOperator } from "./color-rule-types";
import {
  ColorRuleRow,
  ColumnDropdown,
  ToggleSectionHeader,
  AddRuleButton,
  DEFAULT_COLOR_PRESETS,
} from "./color-rule-row";

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
  /** Hide the enable/disable toggle — rules list is always shown; "no rules" acts as disabled */
  hideToggle?: boolean;
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
  hideToggle = false,
}: Readonly<RowColorRuleSetterProps>) {
  const showRules = hideToggle || enabled;

  return (
    <div className="space-y-2">
        {!hideToggle && (
          <ToggleSectionHeader
            label={title}
            enabled={enabled}
            onToggle={onToggle}
          />
        )}

        {showRules && (
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
                    <ColumnDropdown
                      value={rule.column}
                      options={columns}
                      onChange={(key) => onUpdate(rule._id, "column", key)}
                    />
                  }
                />
              ))}
            </div>
            <AddRuleButton
              onClick={onAdd}
              label={tr("dashboard.settings.addRule", dictionary)}
              className="mt-2"
            />
          </div>
        )}
    </div>
  );
}
