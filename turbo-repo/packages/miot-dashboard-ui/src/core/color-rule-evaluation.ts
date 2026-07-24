import type { ColorRuleOperator } from "./color-rule-types";
import { evaluateRule } from "./color-rule-engine";

// ============================================================================
// Color Rule Evaluation Helpers
// ============================================================================
// These helpers reduce cognitive complexity by extracting common patterns
// used when evaluating color rules in dashlet components.
// ============================================================================

/** Check if operator is a "greater than" type */
export function isGreaterOperator(op: string): boolean {
  return op === "greater_than" || op === "greater_than_or_equal";
}

/** Check if operator is a "less than" type */
export function isLessOperator(op: string): boolean {
  return op === "less_than" || op === "less_than_or_equal";
}

// ============================================================================
// Generic rule interface for evaluation
// ============================================================================

/** Minimal rule interface for sorting (only needs operator and value) */
export interface SortableRule {
  operator: ColorRuleOperator;
  value: string;
}

/** Minimal rule interface for color evaluation */
export interface ColorableRule extends SortableRule {
  color: string;
}

/** Minimal rule interface for sorting and evaluation */
export interface EvaluatableRule extends ColorableRule {
  targets: string[];
}

/** Rule with optional compare mode support */
export interface ComparableRule extends EvaluatableRule {
  compareMode?: "static" | "field";
  compareField?: string;
}

// ============================================================================
// Sorting helpers
// ============================================================================

/** Sort rules so most specific matches win */
export function sortColorRules<T extends SortableRule>(rules: T[]): T[] {
  return [...rules].sort((a, b) => {
    const aVal = Number(a.value) || 0;
    const bVal = Number(b.value) || 0;
    const aIsGreater = isGreaterOperator(a.operator);
    const bIsGreater = isGreaterOperator(b.operator);
    const aIsLess = isLessOperator(a.operator);
    const bIsLess = isLessOperator(b.operator);
    if (aIsGreater && bIsGreater) return bVal - aVal;
    if (aIsLess && bIsLess) return aVal - bVal;
    // Mixed types: greater-than before less-than to avoid non-transitive comparator
    // issues where an intervening less-than rule blocks the sort from comparing two
    // greater-than rules against each other (e.g. [>10, <=10, >35] stays unsorted).
    if (aIsGreater && bIsLess) return -1;
    if (aIsLess && bIsGreater) return 1;
    return 0;
  });
}

/** Sort rules with field comparison support */
export function sortColorRulesWithFields<T extends ComparableRule>(
  rules: T[],
  fieldValues: Record<string, number>
): T[] {
  return [...rules].sort((a, b) => {
    const aVal = Number(getCompareValue(a, fieldValues)) || 0;
    const bVal = Number(getCompareValue(b, fieldValues)) || 0;
    const aIsGreater = isGreaterOperator(a.operator);
    const bIsGreater = isGreaterOperator(b.operator);
    const aIsLess = isLessOperator(a.operator);
    const bIsLess = isLessOperator(b.operator);
    if (aIsGreater && bIsGreater) return bVal - aVal;
    if (aIsLess && bIsLess) return aVal - bVal;
    if (aIsGreater && bIsLess) return -1;
    if (aIsLess && bIsGreater) return 1;
    return 0;
  });
}

/** Get comparison value based on rule's compare mode */
export function getCompareValue(
  rule: ComparableRule,
  fieldValues: Record<string, number>,
  defaultField = "previousValue"
): string {
  if (rule.compareMode === "field") {
    const field = rule.compareField ?? defaultField;
    return String(fieldValues[field] ?? 0);
  }
  return rule.value;
}

// ============================================================================
// Generic evaluation function
// ============================================================================

/** Result of evaluating color rules */
export type EvaluatedColors<T extends string> = Partial<Record<T, string>>;

/**
 * Evaluate color rules and return matched colors for each target.
 * Stops early once all targets have been matched.
 */
export function evaluateColorRulesGeneric<
  TTarget extends string,
  TRule extends EvaluatableRule,
>(
  rules: TRule[],
  evalValue: string,
  targetKeys: TTarget[]
): EvaluatedColors<TTarget> {
  const result: EvaluatedColors<TTarget> = {};
  const sortedRules = sortColorRules(rules);
  let foundCount = 0;

  for (const rule of sortedRules) {
    const matches = evaluateRule(
      { column: "", operator: rule.operator, value: rule.value, color: "blue" },
      evalValue
    );
    if (!matches) continue;

    for (const target of targetKeys) {
      if (rule.targets.includes(target) && !result[target]) {
        result[target] = rule.color;
        foundCount++;
      }
    }

    if (foundCount >= targetKeys.length) break;
  }

  return result;
}

/**
 * Evaluate color rules with field comparison support.
 */
export function evaluateColorRulesWithFields<
  TTarget extends string,
  TRule extends ComparableRule,
>(
  rules: TRule[],
  evalValue: string,
  fieldValues: Record<string, number>,
  targetKeys: TTarget[]
): EvaluatedColors<TTarget> {
  const result: EvaluatedColors<TTarget> = {};
  const sortedRules = sortColorRulesWithFields(rules, fieldValues);
  let foundCount = 0;

  for (const rule of sortedRules) {
    const compareValue = getCompareValue(rule, fieldValues);
    const matches = evaluateRule(
      {
        column: "",
        operator: rule.operator,
        value: compareValue,
        color: "blue",
      },
      evalValue
    );
    if (!matches) continue;

    for (const target of targetKeys) {
      if (rule.targets.includes(target) && !result[target]) {
        result[target] = rule.color;
        foundCount++;
      }
    }

    if (foundCount >= targetKeys.length) break;
  }

  return result;
}

// ============================================================================
// Style builder helpers
// ============================================================================

/** Convert hex color to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Build text style from rule color or manual color */
export function buildTextStyle(
  ruleColor: string | undefined,
  manualColor: string | undefined
): React.CSSProperties | undefined {
  if (ruleColor) return { color: `#${ruleColor}` };
  if (manualColor) return { color: `#${manualColor}` };
  return undefined;
}

/** Build background style from rule color or manual setting */
export function buildBgStyle(
  ruleColor: string | undefined,
  showManualColor: boolean,
  manualColor: string,
  opacity = "CC"
): React.CSSProperties | undefined {
  if (ruleColor) return { backgroundColor: `#${ruleColor}${opacity}` };
  if (showManualColor) return { backgroundColor: `#${manualColor}${opacity}` };
  return undefined;
}

/** Build icon style with background tint and text color */
export function buildIconStyle(
  ruleColor: string | undefined,
  manualColor: string
): React.CSSProperties {
  const hex = ruleColor ?? manualColor;
  return { backgroundColor: `#${hex}20`, color: `#${hex}` };
}

/** Get classes based on whether a custom color is applied */
export function getConditionalClasses(
  hasCustomColor: boolean,
  defaultClasses: string
): string {
  return hasCustomColor ? "" : defaultClasses;
}

/** Get badge classes based on color rule or change direction */
export function getBadgeClasses(
  ruleBadgeColor: string | undefined,
  isPositive: boolean
): string {
  if (ruleBadgeColor) return "";
  if (isPositive)
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}
