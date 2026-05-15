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
// Types specific to stat_circular
// ============================================================================

/** What the rule applies to (ring only for this dashlet) */
export type RingColorTarget = "ring";

/** Rule with stable ID for list rendering */
export type RingColorRuleItem = ColorRuleItem<RingColorTarget, string>;

/** Configuration stored in DashletConfig */
export type RingColorRulesConfig = ColorRulesConfig<RingColorTarget, string>;

// ============================================================================
// Constants
// ============================================================================

const VALID_TARGETS = new Set<string>(["ring"]);

// ============================================================================
// Normalization helper
// ============================================================================

export function normalizeRingColorRulesConfig(
  raw: unknown
): RingColorRulesConfig {
  return normalizeColorRulesConfig<RingColorTarget, string>(raw, {
    validTargets: VALID_TARGETS,
    defaultTarget: "ring",
  });
}

// ============================================================================
// Hook for settings state
// ============================================================================

export function useRingColorSettings(config: {
  ringColorRules?: RingColorRulesConfig;
}) {
  const result = useColorRuleSettings<RingColorTarget, string>({
    config: { valueColorRules: config.ringColorRules },
    validTargets: VALID_TARGETS,
    defaultTarget: "ring",
  });

  // Return with correct key name for this dashlet
  return {
    ...result,
    buildSavePayload: () => ({
      ringColorRules: result.buildSavePayload().valueColorRules,
    }),
  };
}

// ============================================================================
// Editor Component
// ============================================================================

interface RingColorRulesEditorProps {
  rules: RingColorRuleItem[];
  dictionary: I18nRecord;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
}

export function RingColorRulesEditor({
  rules,
  dictionary,
  onAdd,
  onRemove,
  onUpdate,
}: Readonly<RingColorRulesEditorProps>) {
  return (
    <ColorRuleSetter<RingColorTarget, string>
      rules={rules}
      dictionary={dictionary}
      targetOptions={[]}
      enableCompareMode={false}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onToggleTarget={() => {}}
      label={tr("dashboard.settings.ringColorRules", dictionary)}
    />
  );
}
