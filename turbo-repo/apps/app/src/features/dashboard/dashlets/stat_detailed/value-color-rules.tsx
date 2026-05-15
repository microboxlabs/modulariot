"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  type ColorRule,
  type ColorRuleItem,
  type ColorRulesConfig,
} from "../common/color-rule-setter";
import {
  normalizeColorRulesConfig,
  ColorRuleSetter,
  useColorRuleSettings,
} from "../common/color-rule-setter";

// ============================================================================
// Types specific to stat_detailed
// ============================================================================

/** What the rule applies to */
export type ValueColorTarget = "text" | "bar" | "badge";

/** Available fields to compare against */
export type CompareField = "previousValue" | "target";

/** A single value color rule for stat_detailed */
export type ValueColorRule = ColorRule<ValueColorTarget, CompareField>;

/** Configuration stored in DashletConfig */
export type ValueColorRulesConfig = ColorRulesConfig<
  ValueColorTarget,
  CompareField
>;

// ============================================================================
// Constants
// ============================================================================

const VALID_TARGETS = new Set<string>(["text", "bar", "badge"]);
const VALID_COMPARE_FIELDS = new Set<string>(["previousValue", "target"]);

// ============================================================================
// Normalization helper
// ============================================================================

export function normalizeValueColorRulesConfig(
  raw: unknown
): ValueColorRulesConfig {
  return normalizeColorRulesConfig<ValueColorTarget, CompareField>(raw, {
    validTargets: VALID_TARGETS,
    defaultTarget: "text",
    validCompareFields: VALID_COMPARE_FIELDS,
    defaultCompareField: "previousValue",
  });
}

function getTargetOptions(dictionary: I18nRecord) {
  return [
    {
      value: "text" as const,
      label: tr("dashboard.settings.targetText", dictionary),
    },
    {
      value: "bar" as const,
      label: tr("dashboard.settings.targetBar", dictionary),
    },
    {
      value: "badge" as const,
      label: tr("dashboard.settings.targetBadge", dictionary),
    },
  ];
}

function getCompareFieldOptions(dictionary: I18nRecord) {
  return [
    {
      value: "previousValue" as const,
      label: tr("dashboard.settings.compareFieldPrevious", dictionary),
    },
    {
      value: "target" as const,
      label: tr("dashboard.settings.compareFieldTarget", dictionary),
    },
  ];
}

// ============================================================================
// Hook for settings state
// ============================================================================

export function useValueColorSettings(config: {
  valueColorRules?: ColorRulesConfig<ValueColorTarget, CompareField>;
}) {
  return useColorRuleSettings<ValueColorTarget, CompareField>({
    config,
    validTargets: VALID_TARGETS,
    defaultTarget: "text",
    validCompareFields: VALID_COMPARE_FIELDS,
    defaultCompareField: "previousValue",
  });
}

// ============================================================================
// Editor Component
// ============================================================================

interface ValueColorRulesEditorProps {
  rules: ColorRuleItem<ValueColorTarget, CompareField>[];
  dictionary: I18nRecord;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onToggleTarget: (id: string, target: ValueColorTarget) => void;
}

export function ValueColorRulesEditor({
  rules,
  dictionary,
  onAdd,
  onRemove,
  onUpdate,
  onToggleTarget,
}: Readonly<ValueColorRulesEditorProps>) {
  return (
    <ColorRuleSetter<ValueColorTarget, CompareField>
      rules={rules}
      dictionary={dictionary}
      targetOptions={getTargetOptions(dictionary)}
      enableCompareMode
      compareFieldOptions={getCompareFieldOptions(dictionary)}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onToggleTarget={onToggleTarget}
    />
  );
}
