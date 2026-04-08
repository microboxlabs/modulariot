"use client";

import { Select, TextInput } from "flowbite-react";
import { HiTrash } from "react-icons/hi2";
import type { ColorRuleOperator, RuleColor } from "./color-rule-types";
import { COLOR_RULE_OPERATORS, RULE_COLORS } from "./color-rule-types";
import { getColorDotClass } from "./color-rule-engine";

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

interface RuleRowControlsProps {
  ruleId: string;
  operator: ColorRuleOperator;
  value: string;
  color: RuleColor;
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  operatorLabels: Record<ColorRuleOperator, string>;
  colorLabels: Record<RuleColor, string>;
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
  colorLabels,
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
      {/* Color select */}
      <div className="w-24 shrink-0">
        <Select
          sizing="sm"
          value={color}
          onChange={(e) => onUpdate(ruleId, "color", e.target.value)}
        >
          {RULE_COLORS.map((c) => (
            <option key={c} value={c}>
              {colorLabels[c]}
            </option>
          ))}
        </Select>
      </div>
      {/* Color dot preview */}
      <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${getColorDotClass(color)}`} />
      {/* Delete button */}
      <button
        type="button"
        onClick={() => onRemove(ruleId)}
        onMouseDown={stopPropagation}
        className="no-drag shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
      >
        <HiTrash className="h-4 w-4" />
      </button>
    </>
  );
}
