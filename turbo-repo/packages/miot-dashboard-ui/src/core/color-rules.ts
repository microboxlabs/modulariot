export type ColorRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export interface ColorRule {
  /** Column key (Handlebars template, e.g. "{{row.status}}") */
  column: string;
  /** Comparison operator */
  operator: ColorRuleOperator;
  /** Value to compare against */
  value: string;
  /** The color to apply when this rule matches (hex without # or legacy named color) */
  color: string;
}

export function evaluateRule(rule: ColorRule, resolvedValue: string): boolean {
  const ruleVal = rule.value.trim();
  const cellVal = resolvedValue.trim();

  switch (rule.operator) {
    case "equals": {
      // Try numeric comparison first, fall back to string comparison
      const numCell = Number.parseFloat(cellVal.replaceAll(/[^\d.-]/g, ""));
      const numRule = Number.parseFloat(ruleVal.replaceAll(/[^\d.-]/g, ""));
      if (!Number.isNaN(numCell) && !Number.isNaN(numRule)) {
        return numCell === numRule;
      }
      return cellVal.toLowerCase() === ruleVal.toLowerCase();
    }
    case "not_equals": {
      // Try numeric comparison first, fall back to string comparison
      const numCell = Number.parseFloat(cellVal.replaceAll(/[^\d.-]/g, ""));
      const numRule = Number.parseFloat(ruleVal.replaceAll(/[^\d.-]/g, ""));
      if (!Number.isNaN(numCell) && !Number.isNaN(numRule)) {
        return numCell !== numRule;
      }
      return cellVal.toLowerCase() !== ruleVal.toLowerCase();
    }
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
  resolveValue: (
    key: string,
    row: Record<string, string>,
    rowIdx: number,
    total: number,
  ) => string,
  rowIdx: number,
  total: number,
): string | null {
  for (const rule of rules) {
    const resolved = resolveValue(rule.column, row, rowIdx, total);
    if (evaluateRule(rule, resolved)) {
      return rule.color;
    }
  }
  return null;
}
