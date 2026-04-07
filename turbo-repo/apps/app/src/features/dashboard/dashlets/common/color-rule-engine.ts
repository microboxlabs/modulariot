import type { ColorRule, RuleColor } from "./color-rule-types";

// ============================================================================
// Rule evaluation
// ============================================================================

export function evaluateRule(rule: ColorRule, resolvedValue: string): boolean {
  const ruleVal = rule.value.trim();
  const cellVal = resolvedValue.trim();

  switch (rule.operator) {
    case "equals":
      return cellVal.toLowerCase() === ruleVal.toLowerCase();
    case "not_equals":
      return cellVal.toLowerCase() !== ruleVal.toLowerCase();
    case "contains":
      return cellVal.toLowerCase().includes(ruleVal.toLowerCase());
    case "not_contains":
      return !cellVal.toLowerCase().includes(ruleVal.toLowerCase());
    case "greater_than":
    case "less_than":
    case "greater_than_or_equal":
    case "less_than_or_equal": {
      const numCell = Number.parseFloat(cellVal.replaceAll(/[^\d.-]/g, ""));
      const numRule = Number.parseFloat(ruleVal);
      if (Number.isNaN(numCell) || Number.isNaN(numRule)) return false;
      if (rule.operator === "greater_than") return numCell > numRule;
      if (rule.operator === "less_than") return numCell < numRule;
      if (rule.operator === "greater_than_or_equal") return numCell >= numRule;
      return numCell <= numRule;
    }
  }
}

export function findMatchingColor(
  rules: ColorRule[],
  row: Record<string, string>,
  resolveValue: (key: string, row: Record<string, string>, rowIdx: number, total: number) => string,
  rowIdx: number,
  total: number,
): RuleColor | null {
  for (const rule of rules) {
    const resolved = resolveValue(rule.column, row, rowIdx, total);
    if (evaluateRule(rule, resolved)) {
      return rule.color;
    }
  }
  return null;
}

// ============================================================================
// Tailwind class mappings (static strings — safe for Tailwind purge)
// ============================================================================

export function getRowColorClasses(color: RuleColor): string {
  switch (color) {
    case "red":
      return "bg-red-50 dark:bg-red-900/20";
    case "yellow":
      return "bg-yellow-50 dark:bg-yellow-900/20";
    case "green":
      return "bg-green-50 dark:bg-green-900/20";
    case "blue":
      return "bg-blue-50 dark:bg-blue-900/20";
    case "orange":
      return "bg-orange-50 dark:bg-orange-900/20";
    case "purple":
      return "bg-purple-50 dark:bg-purple-900/20";
    case "gray":
      return "bg-gray-100 dark:bg-gray-700";
  }
}

export function getBadgeColorClassesByRule(color: RuleColor): string {
  switch (color) {
    case "red":
      return "bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
    case "yellow":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
    case "green":
      return "bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
    case "blue":
      return "bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
    case "orange":
      return "bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800";
    case "purple":
      return "bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
    case "gray":
      return "bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600";
  }
}

export function getColorDotClass(color: RuleColor): string {
  switch (color) {
    case "red":
      return "bg-red-500";
    case "yellow":
      return "bg-yellow-500";
    case "green":
      return "bg-green-500";
    case "blue":
      return "bg-blue-500";
    case "orange":
      return "bg-orange-500";
    case "purple":
      return "bg-purple-500";
    case "gray":
      return "bg-gray-500";
  }
}
