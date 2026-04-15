"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import {
  type ColorRule,
  type ColorRuleItem,
  type ColorRulesConfig,
  normalizeColorRulesConfig,
  ColorRuleSetter,
  useColorRuleSettings,
} from "../common";

// ============================================================================
// Types specific to info_card
// ============================================================================

/** What the rule applies to - text or icon */
export type ValueColorTarget = "text" | "icon";

/** A single value color rule for info_card */
export type ValueColorRule = ColorRule<ValueColorTarget, string>;

/** Rule with stable ID for list rendering */
export type ValueColorRuleItem = ColorRuleItem<ValueColorTarget, string>;

/** Configuration stored in DashletConfig */
export type ValueColorRulesConfig = ColorRulesConfig<ValueColorTarget, string>;

// ============================================================================
// Constants
// ============================================================================

const VALID_TARGETS = new Set<string>(["text", "icon"]);

// ============================================================================
// Normalization helper
// ============================================================================

export function normalizeValueColorRulesConfig(
  raw: unknown
): ValueColorRulesConfig {
  return normalizeColorRulesConfig<ValueColorTarget, string>(raw, {
    validTargets: VALID_TARGETS,
    defaultTarget: "text",
  });
}

function getTargetOptions(dictionary: I18nRecord) {
  return [
    {
      value: "text" as const,
      label: tr("dashboard.settings.targetText", dictionary),
    },
    {
      value: "icon" as const,
      label: tr("dashboard.settings.targetIcon", dictionary),
    },
  ];
}

// ============================================================================
// Hook for settings state
// ============================================================================

export function useValueColorSettings(config: {
  valueColorRules?: ColorRulesConfig<ValueColorTarget, string>;
}) {
  return useColorRuleSettings<ValueColorTarget, string>({
    config,
    validTargets: VALID_TARGETS,
    defaultTarget: "text",
  });
}

// ============================================================================
// Editor Component
// ============================================================================

interface ValueColorRulesEditorProps {
  rules: ColorRuleItem<ValueColorTarget, string>[];
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
    <ColorRuleSetter<ValueColorTarget, string>
      rules={rules}
      dictionary={dictionary}
      targetOptions={getTargetOptions(dictionary)}
      enableCompareMode={false}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onToggleTarget={onToggleTarget}
      label={tr("dashboard.settings.valueColorRules", dictionary)}
    />
  );
}
