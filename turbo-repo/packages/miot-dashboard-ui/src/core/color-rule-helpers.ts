import type { ColorRule, ColorRulesConfig } from "./color-rule-types";
import { COLOR_RULE_OPERATORS } from "./color-rule-types";

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

function isValidRule(r: unknown): r is ColorRule {
  if (r == null || typeof r !== "object") return false;
  const rule = r as Record<string, unknown>;
  return (
    typeof rule.column === "string" &&
    rule.column.length > 0 &&
    typeof rule.operator === "string" &&
    (COLOR_RULE_OPERATORS as string[]).includes(rule.operator) &&
    typeof rule.value === "string" &&
    typeof rule.color === "string" &&
    rule.color.length > 0
  );
}

export function normalizeColorRulesConfig(
  raw: unknown,
  fallback: ColorRulesConfig,
): ColorRulesConfig {
  if (raw == null || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.enabled !== "boolean") return fallback;
  if (!Array.isArray(obj.rules)) return fallback;
  if (!obj.rules.every(isValidRule)) return fallback;
  return { enabled: obj.enabled, rules: obj.rules };
}
