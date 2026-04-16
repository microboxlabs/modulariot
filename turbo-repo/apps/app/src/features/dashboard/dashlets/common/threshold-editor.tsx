"use client";

import { Button, Label, ToggleSwitch } from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import { COLOR_RULE_PRESETS } from "./color-rule-types";
import type { ColorRuleOperator } from "./color-rule-types";
import type { ThresholdRuleItem, ThresholdTarget } from "./threshold-types";
import { THRESHOLD_TARGETS, THRESHOLD_TARGET_LABELS } from "./threshold-types";
import { HbTextField } from "./settings-fields";
import { ColorRuleRow } from "./color-rule-row";

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
                  colorPresets={COLOR_RULE_PRESETS}
                />
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
