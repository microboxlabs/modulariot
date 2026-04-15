"use client";

import { useCallback, useState } from "react";
import { Button, Label, Select } from "flowbite-react";
import { HiPlus, HiTrash } from "react-icons/hi2";
import { twMerge } from "tailwind-merge";
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

/** What the rule applies to */
export type ValueColorTarget = "text" | "bg" | "icon";

/** A single value color rule */
export interface ValueColorRule {
  operator: ColorRuleOperator;
  value: string;
  color: string;
  /** What to apply the color to (can be multiple) */
  targets: ValueColorTarget[];
}

/** Rule with stable ID for list rendering */
export interface ValueColorRuleItem extends ValueColorRule {
  _id: string;
}

/** Configuration stored in DashletConfig */
export interface ValueColorRulesConfig {
  rules: ValueColorRule[];
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

const TARGET_OPTIONS: { value: ValueColorTarget; label: string }[] = [
  { value: "bg", label: "BG" },
  { value: "text", label: "Text" },
  { value: "icon", label: "Icon" },
];

const VALID_TARGETS = new Set<string>(["text", "bg", "icon"]);

function isValidTarget(t: unknown): t is ValueColorTarget {
  return typeof t === "string" && VALID_TARGETS.has(t);
}

// ============================================================================
// Defaults & Helpers
// ============================================================================

export const DEFAULT_VALUE_COLOR_RULES_CONFIG: ValueColorRulesConfig = {
  rules: [],
};

export function normalizeValueColorRulesConfig(
  raw: unknown
): ValueColorRulesConfig {
  if (raw == null || typeof raw !== "object") {
    return DEFAULT_VALUE_COLOR_RULES_CONFIG;
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.rules)) {
    return DEFAULT_VALUE_COLOR_RULES_CONFIG;
  }
  const rules: ValueColorRule[] = [];
  for (const r of obj.rules) {
    if (r == null || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    if (
      typeof rec.operator !== "string" ||
      typeof rec.value !== "string" ||
      typeof rec.color !== "string"
    )
      continue;
    // Support both legacy `target` and new `targets` array
    let targets: ValueColorTarget[];
    if (Array.isArray(rec.targets)) {
      targets = rec.targets.filter(isValidTarget);
    } else if (isValidTarget(rec.target)) {
      targets = [rec.target];
    } else {
      targets = ["text"];
    }
    if (targets.length === 0) targets = ["text"];
    rules.push({
      operator: rec.operator as ColorRuleOperator,
      value: rec.value,
      color: rec.color,
      targets,
    });
  }
  return { rules };
}

function toRuleItems(rules: ValueColorRule[]): ValueColorRuleItem[] {
  return rules.map((rule, i) => ({
    ...rule,
    _id: `vcr-${i}-${rule.value}`,
  }));
}

function fromRuleItems(items: ValueColorRuleItem[]): ValueColorRule[] {
  return items.map((item) => ({
    operator: item.operator,
    value: item.value,
    color: item.color,
    targets: item.targets,
  }));
}

// ============================================================================
// Hook for settings state
// ============================================================================

let nextId = 0;

export function useValueColorSettings(config: {
  valueColorRules?: ValueColorRulesConfig;
}) {
  const normalized = normalizeValueColorRulesConfig(config.valueColorRules);

  const [rules, setRules] = useState<ValueColorRuleItem[]>(
    toRuleItems(normalized.rules)
  );

  const addRule = useCallback(() => {
    setRules((prev) => [
      ...prev,
      {
        _id: `vcr-new-${nextId++}`,
        operator: "greater_than",
        value: "",
        color: DEFAULT_RULE_COLOR,
        targets: ["text"],
      },
    ]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r._id !== id));
  }, []);

  const updateRule = useCallback(
    (id: string, field: string, value: string | ValueColorTarget[]) => {
      setRules((prev) =>
        prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const toggleTarget = useCallback((id: string, target: ValueColorTarget) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r._id !== id) return r;
        const has = r.targets.includes(target);
        // If removing and it's the last one, keep it (at least one must be selected)
        if (has && r.targets.length === 1) return r;
        const newTargets = has
          ? r.targets.filter((t) => t !== target)
          : [...r.targets, target];
        return { ...r, targets: newTargets };
      })
    );
  }, []);

  const buildSavePayload = (): { valueColorRules: ValueColorRulesConfig } => ({
    valueColorRules: {
      rules: fromRuleItems(rules),
    },
  });

  return {
    rules,
    addRule,
    removeRule,
    updateRule,
    toggleTarget,
    buildSavePayload,
  };
}

// ============================================================================
// Editor Component
// ============================================================================

interface ValueColorRulesEditorProps {
  rules: ValueColorRuleItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onToggleTarget: (id: string, target: ValueColorTarget) => void;
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export function ValueColorRulesEditor({
  rules,
  onAdd,
  onRemove,
  onUpdate,
  onToggleTarget,
}: Readonly<ValueColorRulesEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-3">
        <Label className="text-sm font-medium">Value Color Rules</Label>

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
                  placeholder="e.g. 100"
                  value={rule.value}
                  onChange={(e) => onUpdate(rule._id, "value", e.target.value)}
                />
              </div>
              {/* Target multi-toggle (BG/Text/Icon) */}
              <div className="flex shrink-0 rounded-md border border-gray-200 overflow-hidden dark:border-gray-600">
                {TARGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggleTarget(rule._id, opt.value)}
                    className={twMerge(
                      "px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                      rule.targets.includes(opt.value)
                        ? "bg-primary-600 text-white"
                        : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
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
