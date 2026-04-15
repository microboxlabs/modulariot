"use client";

import { useCallback, useState } from "react";
import { Button, Label, Dropdown, DropdownItem } from "flowbite-react";
import { HiPlus, HiTrash, HiChevronDown } from "react-icons/hi2";
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
export type ValueColorTarget = "text" | "bar" | "badge";

/** Compare mode: static value or another field */
export type CompareMode = "static" | "field";

/** Available fields to compare against */
export type CompareField = "previousValue" | "target";

/** A single value color rule */
export interface ValueColorRule {
  operator: ColorRuleOperator;
  /** Static value to compare against (when compareMode is "static") */
  value: string;
  /** Compare mode: static value or field reference */
  compareMode: CompareMode;
  /** Field to compare against (when compareMode is "field") */
  compareField?: CompareField;
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
  { value: "text", label: "Text" },
  { value: "bar", label: "Bar" },
  { value: "badge", label: "Badge" },
];

const COMPARE_MODE_OPTIONS: { value: CompareMode; label: string }[] = [
  { value: "static", label: "Value" },
  { value: "field", label: "Field" },
];

const COMPARE_FIELD_OPTIONS: { value: CompareField; label: string }[] = [
  { value: "previousValue", label: "Previous" },
  { value: "target", label: "Target" },
];

const VALID_TARGETS = new Set<string>(["text", "bar", "badge"]);
const VALID_COMPARE_FIELDS = new Set<string>(["previousValue", "target"]);

function isValidTarget(t: unknown): t is ValueColorTarget {
  return typeof t === "string" && VALID_TARGETS.has(t);
}

function isValidCompareField(f: unknown): f is CompareField {
  return typeof f === "string" && VALID_COMPARE_FIELDS.has(f);
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
    if (typeof rec.operator !== "string" || typeof rec.color !== "string")
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

    // Handle compare mode (default to static for backwards compatibility)
    const compareMode: CompareMode =
      rec.compareMode === "field" ? "field" : "static";
    const compareField = isValidCompareField(rec.compareField)
      ? rec.compareField
      : undefined;
    const value = typeof rec.value === "string" ? rec.value : "";

    rules.push({
      operator: rec.operator as ColorRuleOperator,
      value,
      compareMode,
      compareField,
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
    compareMode: item.compareMode,
    compareField: item.compareField,
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
        compareMode: "static",
        compareField: undefined,
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
            <div
              key={rule._id}
              className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1.5 dark:border-gray-600 dark:bg-gray-700/50"
            >
              {/* Compare mode toggle (Value/Field) */}
              <div className="flex h-7 shrink-0 items-center rounded-md border border-gray-200 overflow-hidden dark:border-gray-600">
                {COMPARE_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onUpdate(rule._id, "compareMode", opt.value)}
                    className={twMerge(
                      "h-7 px-1.5 text-[10px] font-medium transition-colors cursor-pointer",
                      rule.compareMode === opt.value
                        ? "bg-primary-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
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
              {/* Value input OR Field selector */}
              {rule.compareMode === "static" ? (
                <input
                  type="text"
                  className="no-drag h-7 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  placeholder="100"
                  value={rule.value}
                  onChange={(e) => onUpdate(rule._id, "value", e.target.value)}
                />
              ) : (
                <Dropdown
                  label=""
                  dismissOnClick
                  renderTrigger={() => (
                    <button
                      type="button"
                      className="flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-between gap-0.5 rounded-lg border border-gray-300 bg-gray-50 px-1.5 text-xs text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
                    >
                      <span className="truncate">
                        {
                          COMPARE_FIELD_OPTIONS.find(
                            (o) =>
                              o.value === (rule.compareField ?? "previousValue")
                          )?.label
                        }
                      </span>
                      <HiChevronDown className="h-3 w-3 shrink-0" />
                    </button>
                  )}
                >
                  {COMPARE_FIELD_OPTIONS.map((opt) => (
                    <DropdownItem
                      key={opt.value}
                      onClick={() =>
                        onUpdate(rule._id, "compareField", opt.value)
                      }
                      className="text-xs"
                    >
                      {opt.label}
                    </DropdownItem>
                  ))}
                </Dropdown>
              )}
              {/* Target multi-toggle (Text/Bar/Badge) */}
              <div className="flex h-7 shrink-0 items-center rounded-md border border-gray-200 overflow-hidden dark:border-gray-600">
                {TARGET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onToggleTarget(rule._id, opt.value)}
                    className={twMerge(
                      "h-7 px-1.5 text-[10px] font-medium transition-colors cursor-pointer",
                      rule.targets.includes(opt.value)
                        ? "bg-primary-600 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
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
                className="no-drag flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
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
