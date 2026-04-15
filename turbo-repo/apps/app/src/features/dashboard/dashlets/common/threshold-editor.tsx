"use client";

import { Button, Label, ToggleSwitch, Dropdown, DropdownItem } from "flowbite-react";
import { HiPlus, HiChevronDown, HiTrash } from "react-icons/hi2";
import { COLOR_RULE_OPERATORS, OPERATOR_LABELS, COLOR_RULE_PRESETS } from "./color-rule-types";
import type { ThresholdRuleItem, ThresholdTarget } from "./threshold-types";
import { THRESHOLD_TARGETS, THRESHOLD_TARGET_LABELS } from "./threshold-types";
import { HbTextField } from "./settings-fields";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

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
  onUpdate: (id: string, field: string, value: string) => void;
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
  const addTarget = (target: ThresholdTarget) => {
    onApplyToChange([...applyTo, target]);
  };

  const removeTarget = (target: ThresholdTarget) => {
    const next = applyTo.filter((t) => t !== target);
    // Keep at least one target
    if (next.length > 0) onApplyToChange(next);
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
              <Label className="mb-1.5 block text-xs font-medium">
                Apply to
              </Label>
              <div className="flex gap-3">
                {THRESHOLD_TARGETS.map((target) => (
                  <label
                    key={target}
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      checked={applyTo.includes(target)}
                      onChange={(e) =>
                        e.target.checked
                          ? addTarget(target)
                          : removeTarget(target)
                      }
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
                <div
                  key={rule._id}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1.5 dark:border-gray-600 dark:bg-gray-700/50"
                >
                  {/* Operator dropdown */}
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
                    className="no-drag h-7 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                    placeholder="Value"
                    value={rule.value}
                    onChange={(e) =>
                      onUpdate(rule._id, "value", e.target.value)
                    }
                  />
                  {/* Color picker */}
                  <AdvancedColorPicker
                    value={rule.color}
                    onChange={(newColor) =>
                      onUpdate(rule._id, "color", newColor)
                    }
                    presets={COLOR_RULE_PRESETS}
                    title="Select rule color"
                  />
                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => onRemove(rule._id)}
                    onMouseDown={stopPropagation}
                    className="no-drag flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                    aria-label="Delete rule"
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
