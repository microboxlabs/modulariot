"use client";

import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr, trDynamic } from "@/features/i18n/tr.service";
import type {
  ColorRule,
  ColorRuleItem,
  ColorRulesConfig,
  TargetOption,
  CompareFieldOption,
} from "./color-rule-setter";
import {
  normalizeColorRulesConfig,
  ColorRuleSetter,
  useColorRuleSettings,
} from "./color-rule-setter";

export type {
  ColorRule,
  ColorRuleItem,
  ColorRulesConfig,
} from "./color-rule-setter";

// ============================================================================
// Target Configuration Types
// ============================================================================

/** Configuration for a target option */
export interface TargetConfig<T extends string> {
  value: T;
  /** i18n key for the label (e.g., "dashboard.settings.targetText") */
  labelKey: string;
}

/** Factory configuration */
export interface ValueColorRulesFactoryConfig<
  TTarget extends string,
  TCompareField extends string = string,
> {
  /** Valid target values */
  targets: TargetConfig<TTarget>[];
  /** Default target when creating new rules */
  defaultTarget: TTarget;
  /** Whether to enable compare mode (field comparison) */
  enableCompareMode?: boolean;
  /** Compare field options (required if enableCompareMode is true) */
  compareFields?: CompareFieldOption<TCompareField>[];
  /** Default compare field */
  defaultCompareField?: TCompareField;
  /** Custom label i18n key for the section */
  labelKey?: string;
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

/** Generic props for value color rules editor */
export interface ValueColorRulesEditorProps<
  TTarget extends string,
  TCompareField extends string = string,
> {
  rules: ColorRuleItem<TTarget, TCompareField>[];
  dictionary: I18nRecord;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: string, value: string) => void;
  onToggleTarget: (id: string, target: TTarget) => void;
}

// ============================================================================
// Factory function to create value color rules utilities
// ============================================================================

export function createValueColorRulesUtils<
  TTarget extends string,
  TCompareField extends string = string,
>(factoryConfig: ValueColorRulesFactoryConfig<TTarget, TCompareField>) {
  const validTargets = new Set<string>(
    factoryConfig.targets.map((t) => t.value)
  );
  const validCompareFields = factoryConfig.compareFields
    ? new Set<string>(factoryConfig.compareFields.map((f) => f.value))
    : undefined;

  // Type aliases for this specific configuration
  type ValueColorTarget = TTarget;
  type ValueColorRule = ColorRule<TTarget, TCompareField>;
  type ValueColorRuleItem = ColorRuleItem<TTarget, TCompareField>;
  type ValueColorRulesConfig = ColorRulesConfig<TTarget, TCompareField>;

  /** Normalize raw config data */
  function normalizeValueColorRulesConfig(raw: unknown): ValueColorRulesConfig {
    return normalizeColorRulesConfig<TTarget, TCompareField>(raw, {
      validTargets,
      defaultTarget: factoryConfig.defaultTarget,
      validCompareFields,
      defaultCompareField: factoryConfig.defaultCompareField,
    });
  }

  /** Get target options with translated labels */
  function getTargetOptions(dictionary: I18nRecord): TargetOption<TTarget>[] {
    return factoryConfig.targets.map((t) => ({
      value: t.value,
      label: trDynamic(t.labelKey, dictionary),
    }));
  }

  /** Hook for managing color rule settings state */
  function useValueColorSettings(config: {
    valueColorRules?: ColorRulesConfig<TTarget, TCompareField>;
  }) {
    return useColorRuleSettings<TTarget, TCompareField>({
      config,
      validTargets,
      defaultTarget: factoryConfig.defaultTarget,
      validCompareFields,
      defaultCompareField: factoryConfig.defaultCompareField,
    });
  }

  /** Editor component */
  function ValueColorRulesEditor({
    rules,
    dictionary,
    onAdd,
    onRemove,
    onUpdate,
    onToggleTarget,
  }: Readonly<ValueColorRulesEditorProps<TTarget, TCompareField>>) {
    const label = factoryConfig.labelKey
      ? trDynamic(factoryConfig.labelKey, dictionary)
      : tr("dashboard.settings.valueColorRules", dictionary);

    return (
      <ColorRuleSetter<TTarget, TCompareField>
        rules={rules}
        dictionary={dictionary}
        targetOptions={getTargetOptions(dictionary)}
        enableCompareMode={factoryConfig.enableCompareMode ?? false}
        compareFieldOptions={factoryConfig.compareFields}
        onAdd={onAdd}
        onRemove={onRemove}
        onUpdate={onUpdate}
        onToggleTarget={onToggleTarget}
        label={label}
      />
    );
  }

  return {
    normalizeValueColorRulesConfig,
    getTargetOptions,
    useValueColorSettings,
    ValueColorRulesEditor,
    // Export the valid targets set for use in evaluation
    validTargets,
  };
}

// ============================================================================
// Pre-configured factories for common patterns
// ============================================================================

/** Text + Icon targets (info_card) */
export const textIconTargets: TargetConfig<"text" | "icon">[] = [
  { value: "text", labelKey: "dashboard.settings.targetText" },
  { value: "icon", labelKey: "dashboard.settings.targetIcon" },
];

/** Text + Background targets (stat_expandable) */
export const textBgTargets: TargetConfig<"text" | "bg">[] = [
  { value: "text", labelKey: "dashboard.settings.targetText" },
  { value: "bg", labelKey: "dashboard.settings.targetBg" },
];

/** Text + Background + Icon targets (stat_icon) */
export const textBgIconTargets: TargetConfig<"text" | "bg" | "icon">[] = [
  { value: "bg", labelKey: "dashboard.settings.targetBg" },
  { value: "text", labelKey: "dashboard.settings.targetText" },
  { value: "icon", labelKey: "dashboard.settings.targetIcon" },
];

/** Border + Icon + Text targets (stat_status) */
export const borderIconTextTargets: TargetConfig<"border" | "icon" | "text">[] =
  [
    { value: "border", labelKey: "dashboard.settings.targetBorder" },
    { value: "icon", labelKey: "dashboard.settings.targetIcon" },
    { value: "text", labelKey: "dashboard.settings.targetText" },
  ];

/** Text + Bar + Badge targets (stat_detailed) */
export const textBarBadgeTargets: TargetConfig<"text" | "bar" | "badge">[] = [
  { value: "text", labelKey: "dashboard.settings.targetText" },
  { value: "bar", labelKey: "dashboard.settings.targetBar" },
  { value: "badge", labelKey: "dashboard.settings.targetBadge" },
];
