import { COLOR_RULE_OPERATORS } from "./color-rule-types";
import type {
  ThresholdConfig,
  ThresholdRule,
  ThresholdRuleItem,
  ThresholdTarget,
} from "./threshold-types";
import { THRESHOLD_TARGETS } from "./threshold-types";

export const DEFAULT_THRESHOLD_CONFIG: ThresholdConfig = {
  enabled: false,
  field: "",
  applyTo: ["background"],
  rules: [],
};

export function toThresholdRuleItems(
  rules: ThresholdRule[]
): ThresholdRuleItem[] {
  return rules.map((rule, i) => ({
    ...rule,
    _id: `tr-${i}-${rule.value}`,
  }));
}

export function fromThresholdRuleItems(
  items: ThresholdRuleItem[]
): ThresholdRule[] {
  return items.map((item) => ({
    operator: item.operator,
    value: item.value,
    color: item.color,
  }));
}

function isValidThresholdRule(r: unknown): r is ThresholdRule {
  if (r == null || typeof r !== "object") return false;
  const rule = r as Record<string, unknown>;
  return (
    typeof rule.operator === "string" &&
    (COLOR_RULE_OPERATORS as string[]).includes(rule.operator) &&
    typeof rule.value === "string" &&
    typeof rule.color === "string"
  );
}

function isValidTarget(t: unknown): t is ThresholdTarget {
  return typeof t === "string" && (THRESHOLD_TARGETS as string[]).includes(t);
}

export function normalizeThresholdConfig(raw: unknown): ThresholdConfig {
  if (raw == null || typeof raw !== "object") return DEFAULT_THRESHOLD_CONFIG;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.enabled !== "boolean") return DEFAULT_THRESHOLD_CONFIG;
  if (typeof obj.field !== "string") return DEFAULT_THRESHOLD_CONFIG;
  if (!Array.isArray(obj.rules) || !obj.rules.every(isValidThresholdRule))
    return DEFAULT_THRESHOLD_CONFIG;
  const applyTo = Array.isArray(obj.applyTo)
    ? (obj.applyTo as unknown[]).filter(isValidTarget)
    : DEFAULT_THRESHOLD_CONFIG.applyTo;
  return { enabled: obj.enabled, field: obj.field, applyTo, rules: obj.rules };
}
