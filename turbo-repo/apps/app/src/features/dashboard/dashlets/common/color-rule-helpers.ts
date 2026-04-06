import type { ColorRule, ColorRulesConfig } from "./color-rule-types";

export interface ColorRuleItem extends ColorRule {
  _id: string;
}

export function toColorRuleItems(rules: ColorRule[]): ColorRuleItem[] {
  return rules.map((rule, i) => ({
    ...rule,
    _id: `cr-${i}-${rule.column}`,
  }));
}

export function fromColorRuleItems(items: ColorRuleItem[]): ColorRule[] {
  return items.map(({ _id, ...rule }) => rule);
}

export function normalizeColorRulesConfig(
  raw: unknown,
  fallback: ColorRulesConfig,
): ColorRulesConfig {
  if (
    raw != null &&
    typeof raw === "object" &&
    "enabled" in raw &&
    "rules" in raw &&
    Array.isArray((raw as ColorRulesConfig).rules)
  ) {
    return raw as ColorRulesConfig;
  }
  return fallback;
}
