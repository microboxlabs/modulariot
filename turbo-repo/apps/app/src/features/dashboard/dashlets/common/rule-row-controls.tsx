"use client";

import { Select, TextInput } from "flowbite-react";
import type { ColorRuleOperator } from "./color-rule-types";
import { COLOR_RULE_OPERATORS, COLOR_RULE_PRESETS } from "./color-rule-types";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import { DeleteItemButton } from "./delete-item-button";

interface RuleRowControlsProps {
  ruleId: string;
  operator: ColorRuleOperator;
  value: string;
  color: string;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  operatorLabels: Record<ColorRuleOperator, string>;
  valuePlaceholder: string;
}

export function RuleRowControls({
  ruleId,
  operator,
  value,
  color,
  onUpdate,
  onRemove,
  operatorLabels,
  valuePlaceholder,
}: Readonly<RuleRowControlsProps>) {
  return (
    <>
      {/* Operator select */}
      <div className="w-24 shrink-0">
        <Select
          sizing="sm"
          value={operator}
          onChange={(e) => onUpdate(ruleId, "operator", e.target.value)}
          className="[&>select]:cursor-pointer"
        >
          {COLOR_RULE_OPERATORS.map((op) => (
            <option key={op} value={op}>
              {operatorLabels[op]}
            </option>
          ))}
        </Select>
      </div>
      {/* Value input */}
      <div className="min-w-0 flex-1">
        <TextInput
          sizing="sm"
          placeholder={valuePlaceholder}
          value={value}
          onChange={(e) => onUpdate(ruleId, "value", e.target.value)}
        />
      </div>
      {/* Color picker */}
      <AdvancedColorPicker
        value={color}
        onChange={(newColor) => onUpdate(ruleId, "color", newColor)}
        presets={COLOR_RULE_PRESETS}
        title="Select rule color"
      />
      {/* Delete button */}
      <DeleteItemButton
        onClick={() => onRemove(ruleId)}
        ariaLabel="Delete rule"
      />
    </>
  );
}
