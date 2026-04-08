"use client";

import { Button, Label, Select, TextInput, ToggleSwitch } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import type { ColorRuleOperator, RuleColor } from "./color-rule-types";
import { COLOR_RULE_OPERATORS, RULE_COLORS } from "./color-rule-types";
import { OPERATOR_LABELS } from "./color-rule-types";
import { getColorDotClass } from "./color-rule-engine";
import type { ThresholdRuleItem, ThresholdTarget } from "./threshold-types";
import { THRESHOLD_TARGETS, THRESHOLD_TARGET_LABELS } from "./threshold-types";
import { HbTextField } from "./settings-fields";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

const RULE_COLOR_LABELS: Record<RuleColor, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  blue: "Blue",
  orange: "Orange",
  purple: "Purple",
  gray: "Gray",
};

interface ThresholdEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  field: string;
  onFieldChange: (field: string) => void;
  applyTo: ThresholdTarget[];
  onApplyToChange: (targets: ThresholdTarget[]) => void;
  rules: ThresholdRuleItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: "operator" | "value" | "color", value: string) => void;
  schemaSuggestions?: string[];
}

export function ThresholdEditor({
  enabled,
  onToggle,
  field,
  onFieldChange,
  applyTo,
  onApplyToChange,
  rules,
  onAdd,
  onRemove,
  onUpdate,
  schemaSuggestions,
}: Readonly<ThresholdEditorProps>) {
  const handleTargetToggle = (target: ThresholdTarget, checked: boolean) => {
    if (checked) {
      onApplyToChange([...applyTo, target]);
    } else {
      const next = applyTo.filter((t) => t !== target);
      // Keep at least one target
      if (next.length > 0) onApplyToChange(next);
    }
  };

  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Thresholds</Label>
          <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
        </div>

        {enabled && (
          <div className="space-y-3">
            {/* Field to evaluate */}
            <HbTextField
              id="threshold-field"
              label="Evaluate field"
              value={field}
              onChange={onFieldChange}
              placeholder="{{row.value}}"
              schemaSuggestions={schemaSuggestions}
            />

            {/* Apply to checkboxes */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium">Apply to</Label>
              <div className="flex gap-3">
                {THRESHOLD_TARGETS.map((target) => (
                  <label key={target} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={applyTo.includes(target)}
                      onChange={(e) => handleTargetToggle(target, e.target.checked)}
                      className="no-drag h-3.5 w-3.5 rounded border-gray-300 text-blue-600 dark:border-gray-600"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">
                      {THRESHOLD_TARGET_LABELS[target]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Rules */}
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule._id} className="flex items-center gap-1">
                  {/* Operator select */}
                  <div className="w-24 shrink-0">
                    <Select
                      sizing="sm"
                      value={rule.operator}
                      onChange={(e) => onUpdate(rule._id, "operator", e.target.value)}
                    >
                      {COLOR_RULE_OPERATORS.map((op) => (
                        <option key={op} value={op}>
                          {OPERATOR_LABELS[op as ColorRuleOperator]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {/* Value input */}
                  <div className="min-w-0 flex-1">
                    <TextInput
                      sizing="sm"
                      placeholder="Value"
                      value={rule.value}
                      onChange={(e) => onUpdate(rule._id, "value", e.target.value)}
                    />
                  </div>
                  {/* Color select */}
                  <div className="w-24 shrink-0">
                    <Select
                      sizing="sm"
                      value={rule.color}
                      onChange={(e) => onUpdate(rule._id, "color", e.target.value)}
                    >
                      {RULE_COLORS.map((c) => (
                        <option key={c} value={c}>
                          {RULE_COLOR_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {/* Color dot preview */}
                  <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${getColorDotClass(rule.color)}`} />
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => onRemove(rule._id)}
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
              className="no-drag"
            >
              <HiPlus className="mr-1 h-3 w-3" />
              Add rule
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
