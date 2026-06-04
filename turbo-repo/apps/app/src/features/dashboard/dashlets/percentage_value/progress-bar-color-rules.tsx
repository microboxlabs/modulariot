"use client";

import { useState } from "react";
import { Label } from "flowbite-react";
import { twMerge } from "tailwind-merge";
import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import {
  type ColorRule,
  type ColorRuleItem,
} from "../common/color-rule-setter";
import {
  normalizeColorRulesConfig,
  ColorRuleSetter,
  useColorRuleSettings,
} from "../common/color-rule-setter";

// ============================================================================
// Types
// ============================================================================

/** Evaluation mode for progress bar rules */
export type ProgressBarEvalMode = "count" | "percentage";

/** What the rule applies to (bar only for this dashlet) */
export type BarColorTarget = "bar";

/** A single progress bar color rule */
export type ProgressBarRule = ColorRule<BarColorTarget, string>;

/** Rule with stable ID for list rendering */
export type ProgressBarRuleItem = ColorRuleItem<BarColorTarget, string>;

/** Configuration stored in DashletConfig */
export interface ProgressBarColorConfig {
  enabled: boolean;
  /** Whether to evaluate rules against "count" (raw value) or "percentage" */
  evalMode: ProgressBarEvalMode;
  rules: ProgressBarRule[];
}

// ============================================================================
// Constants
// ============================================================================

const VALID_TARGETS = new Set<string>(["bar"]);

const EVAL_MODE_OPTIONS: { value: ProgressBarEvalMode; labelKey: string }[] = [
  { value: "percentage", labelKey: "%" },
  { value: "count", labelKey: "dashboard.settings.evalModeCount" },
];

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
  const evalMode =
    obj.evalMode === "count" || obj.evalMode === "percentage"
      ? obj.evalMode
      : "percentage";

  const normalizedRules = normalizeColorRulesConfig<BarColorTarget, string>(
    { rules: obj.rules },
    { validTargets: VALID_TARGETS, defaultTarget: "bar" }
  );

  return {
    enabled: obj.enabled === true || normalizedRules.rules.length > 0,
    evalMode,
    rules: normalizedRules.rules,
  };
}

// ============================================================================
// Hook for settings state
// ============================================================================

export function useProgressBarColorSettings(config: {
  barColorRules?: ProgressBarColorConfig;
}) {
  const normalized = normalizeProgressBarColorConfig(config.barColorRules);

  const [evalMode, setEvalMode] = useState<ProgressBarEvalMode>(
    normalized.evalMode
  );

  const colorRules = useColorRuleSettings<BarColorTarget, string>({
    config: { valueColorRules: { rules: normalized.rules } },
    validTargets: VALID_TARGETS,
    defaultTarget: "bar",
  });

  const buildSavePayload = (): { barColorRules: ProgressBarColorConfig } => ({
    barColorRules: {
      enabled: true,
      evalMode,
      rules: colorRules.buildSavePayload().valueColorRules.rules,
    },
  });

  return {
    evalMode,
    setEvalMode,
    rules: colorRules.rules,
    addRule: colorRules.addRule,
    removeRule: colorRules.removeRule,
    updateRule: colorRules.updateRule,
    toggleTarget: colorRules.toggleTarget,
    buildSavePayload,
  };
}

// ============================================================================
// Editor Component
// ============================================================================

interface ProgressBarColorRulesEditorProps {
  evalMode: ProgressBarEvalMode;
  onEvalModeChange: (mode: ProgressBarEvalMode) => void;
  rules: ProgressBarRuleItem[];
  dictionary: I18nRecord;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
}

export function ProgressBarColorRulesEditor({
  evalMode,
  onEvalModeChange,
  rules,
  dictionary,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<ProgressBarColorRulesEditorProps>) {
  return (
    <>
      <hr className="border-gray-200 dark:border-gray-700" />
      <div className="space-y-3">
        <Label className="text-sm font-medium">
          {tr("dashboard.settings.barColorRules", dictionary)}
        </Label>
        {/* Eval mode toggle */}
        <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
          {EVAL_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onEvalModeChange(opt.value)}
              className={twMerge(
                "flex-1 cursor-pointer px-3 py-1.5 text-sm font-medium transition-colors",
                evalMode === opt.value
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              )}
            >
              {opt.labelKey === "%" ? "%" : trDynamic(opt.labelKey, dictionary)}
            </button>
          ))}
        </div>
      </div>

      {/* Rules using ColorRuleSetter */}
      <ColorRuleSetter<BarColorTarget, string>
        rules={rules}
        dictionary={dictionary}
        targetOptions={[]}
        enableCompareMode={false}
        onAdd={onAdd}
        onRemove={onRemove}
        onUpdate={onUpdate}
        onToggleTarget={() => {}}
        showSeparator={false}
      />
    </>
  );
}
