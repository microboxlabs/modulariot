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
// Types specific to stat_progress
// ============================================================================

/** What the rule applies to (bar only for this dashlet) */
export type BarColorTarget = "bar";

/** A single bar color rule */
export type BarColorRule = ColorRule<BarColorTarget, string>;

/** Rule with stable ID for list rendering */
export type BarColorRuleItem = ColorRuleItem<BarColorTarget, string>;

/** Configuration stored in DashletConfig */
export type BarColorRulesConfig = ColorRulesConfig<BarColorTarget, string>;

// ============================================================================
// Constants
// ============================================================================

const VALID_TARGETS = new Set<string>(["bar"]);

// ============================================================================
// Normalization helper
// ============================================================================

export function normalizeBarColorRulesConfig(
  raw: unknown
): BarColorRulesConfig {
  return normalizeColorRulesConfig<BarColorTarget, string>(raw, {
    validTargets: VALID_TARGETS,
    defaultTarget: "bar",
  });
}

// ============================================================================
// Hook for settings state
// ============================================================================

export function useBarColorSettings(config: {
  barColorRules?: BarColorRulesConfig;
}) {
  const result = useColorRuleSettings<BarColorTarget, string>({
    config: { valueColorRules: config.barColorRules },
    validTargets: VALID_TARGETS,
    defaultTarget: "bar",
  });

  // Return with correct key name for this dashlet
  return {
    ...result,
    buildSavePayload: () => ({
      barColorRules: result.buildSavePayload().valueColorRules,
    }),
  };
}

// ============================================================================
// Editor Component
// ============================================================================

interface BarColorRulesEditorProps {
  rules: BarColorRuleItem[];
  dictionary: I18nRecord;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
}

export function BarColorRulesEditor({
  rules,
  dictionary,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<BarColorRulesEditorProps>) {
  return (
    <ColorRuleSetter<BarColorTarget, string>
      rules={rules}
      dictionary={dictionary}
      targetOptions={[]}
      enableCompareMode={false}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onToggleTarget={() => {}}
      label={tr("dashboard.settings.barColorRules", dictionary)}
    />
  );
}
