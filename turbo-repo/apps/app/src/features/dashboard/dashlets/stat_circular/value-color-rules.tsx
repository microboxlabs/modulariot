"use client";

import { useCallback, useState } from "react";
import { Button, Label, Select } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import type { PresetColor } from "@/features/common/components/advanced-color-picker";
import type { ColorRuleOperator } from "../common/color-rule-types";
import {
  COLOR_RULE_OPERATORS,
  OPERATOR_LABELS,
} from "../common/color-rule-types";

// ============================================================================
// Types
// ============================================================================

/** A single ring color rule */
export interface RingColorRule {
  operator: ColorRuleOperator;
  value: string;
  color: string;
}

/** Rule with stable ID for list rendering */
export interface RingColorRuleItem extends RingColorRule {
  _id: string;
}

/** Configuration stored in DashletConfig */
export interface RingColorRulesConfig {
  rules: RingColorRule[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RULE_COLOR = "3b82f6";

const COLOR_RULE_PRESETS: PresetColor[] = [
  { value: "ef4444", label: "Red" },
  { value: "f97316", label: "Orange" },
  { value: "eab308", label: "Yellow" },
  { value: "22c55e", label: "Green" },
  { value: "3b82f6", label: "Blue" },
  { value: "8b5cf6", label: "Purple" },
  { value: "6b7280", label: "Gray" },
];

// ============================================================================
// Defaults & Helpers
// ============================================================================

export const DEFAULT_RING_COLOR_RULES_CONFIG: RingColorRulesConfig = {
  rules: [],
};

export function normalizeRingColorRulesConfig(
  raw: unknown
): RingColorRulesConfig {
  if (raw == null || typeof raw !== "object") {
    return DEFAULT_RING_COLOR_RULES_CONFIG;
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.rules)) {
    return DEFAULT_RING_COLOR_RULES_CONFIG;
  }
  const rules = obj.rules.filter(
    (r): r is RingColorRule =>
      r != null &&
      typeof r === "object" &&
      typeof (r as Record<string, unknown>).operator === "string" &&
      typeof (r as Record<string, unknown>).value === "string" &&
      typeof (r as Record<string, unknown>).color === "string"
  );
  return { rules };
}

function toRuleItems(rules: RingColorRule[]): RingColorRuleItem[] {
  return rules.map((rule, i) => ({
    ...rule,
    _id: `rcr-${i}-${rule.value}`,
  }));
}

function fromRuleItems(items: RingColorRuleItem[]): RingColorRule[] {
  return items.map((item) => ({
    operator: item.operator,
    value: item.value,
    color: item.color,
  }));
}

// ============================================================================
// Hook for settings state
// ============================================================================

let nextId = 0;

export function useRingColorSettings(config: {
  ringColorRules?: RingColorRulesConfig;
}) {
  const normalized = normalizeRingColorRulesConfig(config.ringColorRules);

  const [rules, setRules] = useState<RingColorRuleItem[]>(
    toRuleItems(normalized.rules)
  );

  const addRule = useCallback(() => {
    setRules((prev) => [
      ...prev,
      {
        _id: `rcr-new-${nextId++}`,
        operator: "greater_than",
        value: "",
        color: DEFAULT_RULE_COLOR,
      },
    ]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r._id !== id));
  }, []);

  const updateRule = useCallback((id: string, field: string, value: string) => {
    setRules((prev) =>
      prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
    );
  }, []);

  const buildSavePayload = (): { ringColorRules: RingColorRulesConfig } => ({
    ringColorRules: {
      rules: fromRuleItems(rules),
    },
  });

  return {
    rules,
    addRule,
    removeRule,
    updateRule,
    buildSavePayload,
  };
}

// ============================================================================
// Editor Component
// ============================================================================

interface RingColorRulesEditorProps {
  rules: RingColorRuleItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export function RingColorRulesEditor({
  rules,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<RingColorRulesEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-3">
        <Label className="text-sm font-medium">Ring Color Rules</Label>

        {/* Rules */}
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule._id} className="flex items-center gap-1">
              {/* Operator */}
              <div className="w-20 shrink-0">
                <Select
                  sizing="sm"
                  value={rule.operator}
                  onChange={(e) =>
                    onUpdate(rule._id, "operator", e.target.value)
                  }
                  className="[&>select]:cursor-pointer"
                >
                  {COLOR_RULE_OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {OPERATOR_LABELS[op]}
                    </option>
                  ))}
                </Select>
              </div>
              {/* Value */}
              <div className="min-w-0 flex-1">
                <input
                  type="text"
                  className="no-drag block w-full rounded-lg border border-gray-300 bg-gray-50 p-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="e.g. 80"
                  value={rule.value}
                  onChange={(e) => onUpdate(rule._id, "value", e.target.value)}
                />
              </div>
              {/* Color */}
              <AdvancedColorPicker
                value={rule.color}
                onChange={(c) => onUpdate(rule._id, "color", c)}
                presets={COLOR_RULE_PRESETS}
                title="Select rule color"
              />
              {/* Delete */}
              <button
                type="button"
                onClick={() => onRemove(rule._id)}
                onMouseDown={stopPropagation}
                className="no-drag flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
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
    </>
  );
}
