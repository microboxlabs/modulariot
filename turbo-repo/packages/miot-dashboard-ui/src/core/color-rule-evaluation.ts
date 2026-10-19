import { evaluateRule, type ColorRuleOperator } from "./color-rules";

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

/** Sort only threshold slots; non-threshold rules keep their original positions. */
function sortThresholds<T extends SortableRule>(
  rules: T[],
  valueOf: (rule: T) => number,
): T[] {
  const isThreshold = (rule: T) =>
    isGreaterOperator(rule.operator) || isLessOperator(rule.operator);
  const thresholds = rules.filter(isThreshold).sort((a, b) => {
    const aGreater = isGreaterOperator(a.operator);
    const bGreater = isGreaterOperator(b.operator);
    if (aGreater !== bGreater) return aGreater ? -1 : 1;
    return aGreater ? valueOf(b) - valueOf(a) : valueOf(a) - valueOf(b);
  });
  let index = 0;
  return rules.map((rule) =>
    isThreshold(rule) ? (thresholds[index++] ?? rule) : rule,
  );
}

/** Prefer strongest numeric thresholds without moving non-threshold slots. */
export function sortColorRules<T extends SortableRule>(rules: T[]): T[] {
  return sortThresholds(rules, (rule) => Number(rule.value) || 0);
}

/** Apply the same ordering using resolved comparison fields. */
export function sortColorRulesWithFields<T extends ComparableRule>(
  rules: T[],
  fieldValues: Record<string, number>,
): T[] {
  return sortThresholds(
    rules,
    (rule) => Number(getCompareValue(rule, fieldValues)) || 0,
  );
}

/** Get comparison value based on rule's compare mode */
export function getCompareValue(
  rule: ComparableRule,
  fieldValues: Record<string, number>,
  defaultField = "previousValue",
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
  targetKeys: TTarget[],
): EvaluatedColors<TTarget> {
  const result: EvaluatedColors<TTarget> = {};
  const sortedRules = sortColorRules(rules);
  let foundCount = 0;

  for (const rule of sortedRules) {
    const matches = evaluateRule(
      { column: "", operator: rule.operator, value: rule.value, color: "blue" },
      evalValue,
    );
    if (!matches) continue;

    for (const target of targetKeys) {
      if (rule.targets.includes(target) && !Object.hasOwn(result, target)) {
        Object.defineProperty(result, target, {
          value: rule.color,
          enumerable: true,
          configurable: true,
          writable: true,
        });
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
  targetKeys: TTarget[],
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
      evalValue,
    );
    if (!matches) continue;

    for (const target of targetKeys) {
      if (rule.targets.includes(target) && !Object.hasOwn(result, target)) {
        Object.defineProperty(result, target, {
          value: rule.color,
          enumerable: true,
          configurable: true,
          writable: true,
        });
        foundCount++;
      }
    }

    if (foundCount >= targetKeys.length) break;
  }

  return result;
}
