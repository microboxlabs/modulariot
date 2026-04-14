"use client";

import { useCallback, useState } from "react";
import { Button, Label, Select, ToggleSwitch } from "flowbite-react";
import { HiPlus } from "react-icons/hi2";
import { AdvancedColorPicker } from "@/features/common/components/advanced-color-picker";
import { DeleteItemButton } from "../common/delete-item-button";
import type { ColorRuleOperator } from "../common/color-rule-types";
import {
  COLOR_RULE_OPERATORS,
  COLOR_RULE_PRESETS,
  OPERATOR_LABELS,
  DEFAULT_RULE_COLOR,
} from "../common/color-rule-types";

// ============================================================================
// Types
// ============================================================================

/** Evaluation mode for progress bar rules */
export type ProgressBarEvalMode = "count" | "percentage";

/** A single progress bar color rule */
export interface ProgressBarRule {
  operator: ColorRuleOperator;
  value: string;
  color: string;
}

/** Rule with stable ID for list rendering */
export interface ProgressBarRuleItem extends ProgressBarRule {
  _id: string;
}

/** Configuration stored in DashletConfig */
export interface ProgressBarColorConfig {
  enabled: boolean;
  /** Whether to evaluate rules against "count" (raw value) or "percentage" */
  evalMode: ProgressBarEvalMode;
  rules: ProgressBarRule[];
}

// ============================================================================
// Defaults & Helpers
// ============================================================================

export const DEFAULT_PROGRESS_BAR_COLOR_CONFIG: ProgressBarColorConfig = {
  enabled: false,
  evalMode: "percentage",
  rules: [],
};

export function normalizeProgressBarColorConfig(
  raw: unknown
): ProgressBarColorConfig {
  if (raw == null || typeof raw !== "object") {
    return DEFAULT_PROGRESS_BAR_COLOR_CONFIG;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.enabled !== "boolean") {
    return DEFAULT_PROGRESS_BAR_COLOR_CONFIG;
  }
  const evalMode =
    obj.evalMode === "count" || obj.evalMode === "percentage"
      ? obj.evalMode
      : "percentage";
  if (!Array.isArray(obj.rules)) {
    return { enabled: obj.enabled, evalMode, rules: [] };
  }
  const rules = obj.rules.filter(
    (r): r is ProgressBarRule =>
      r != null &&
      typeof r === "object" &&
      typeof (r as Record<string, unknown>).operator === "string" &&
      typeof (r as Record<string, unknown>).value === "string" &&
      typeof (r as Record<string, unknown>).color === "string"
  );
  return { enabled: obj.enabled, evalMode, rules };
}

function toRuleItems(rules: ProgressBarRule[]): ProgressBarRuleItem[] {
  return rules.map((rule, i) => ({
    ...rule,
    _id: `pbr-${i}-${rule.value}`,
  }));
}

function fromRuleItems(items: ProgressBarRuleItem[]): ProgressBarRule[] {
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

export function useProgressBarColorSettings(config: {
  barColorRules?: ProgressBarColorConfig;
}) {
  const normalized = normalizeProgressBarColorConfig(config.barColorRules);

  const [enabled, setEnabled] = useState(normalized.enabled);
  const [evalMode, setEvalMode] = useState<ProgressBarEvalMode>(
    normalized.evalMode
  );
  const [rules, setRules] = useState<ProgressBarRuleItem[]>(
    toRuleItems(normalized.rules)
  );

  const addRule = useCallback(() => {
    setRules((prev) => [
      ...prev,
      {
        _id: `pbr-new-${nextId++}`,
        operator: "greater_than",
        value: "",
        color: DEFAULT_RULE_COLOR,
      },
    ]);
  }, []);

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r._id !== id));
  }, []);

  const updateRule = useCallback(
    (id: string, field: string, value: string) => {
      setRules((prev) =>
        prev.map((r) => (r._id === id ? { ...r, [field]: value } : r))
      );
    },
    []
  );

  const buildSavePayload = (): { barColorRules: ProgressBarColorConfig } => ({
    barColorRules: {
      enabled,
      evalMode,
      rules: fromRuleItems(rules),
    },
  });

  return {
    enabled,
    setEnabled,
    evalMode,
    setEvalMode,
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

interface ProgressBarColorRulesEditorProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  evalMode: ProgressBarEvalMode;
  onEvalModeChange: (mode: ProgressBarEvalMode) => void;
  rules: ProgressBarRuleItem[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
}

const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();

export function ProgressBarColorRulesEditor({
  enabled,
  onToggle,
  evalMode,
  onEvalModeChange,
  rules,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<ProgressBarColorRulesEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Bar Color Rules</Label>
          <ToggleSwitch checked={enabled} onChange={onToggle} sizing="sm" />
        </div>

        {enabled && (
          <div className="space-y-3">
            {/* Eval mode selector */}
            <div>
              <Label className="mb-1.5 block text-xs font-medium">
                Evaluate based on
              </Label>
              <Select
                sizing="sm"
                value={evalMode}
                onChange={(e) =>
                  onEvalModeChange(e.target.value as ProgressBarEvalMode)
                }
                className="[&>select]:cursor-pointer"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="count">Count (raw value)</option>
              </Select>
            </div>

            {/* Rules */}
            <div className="space-y-2">
              {rules.map((rule) => (
                <div key={rule._id} className="flex items-center gap-1">
                  {/* Operator */}
                  <div className="w-24 shrink-0">
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
                      placeholder={evalMode === "percentage" ? "e.g. 80" : "e.g. 8"}
                      value={rule.value}
                      onChange={(e) =>
                        onUpdate(rule._id, "value", e.target.value)
                      }
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
                  <DeleteItemButton
                    onClick={() => onRemove(rule._id)}
                    ariaLabel="Delete rule"
                  />
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
