export type ColorRuleOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal";

export const COLOR_RULE_OPERATORS: ColorRuleOperator[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
];

export const OPERATOR_LABELS: Record<ColorRuleOperator, string> = {
  equals: "=",
  not_equals: "!=",
  contains: "contains",
  not_contains: "!contains",
  greater_than: ">",
  less_than: "<",
  greater_than_or_equal: ">=",
  less_than_or_equal: "<=",
};

export type RuleColor = "red" | "yellow" | "green" | "blue" | "gray" | "orange" | "purple";

export const RULE_COLORS: RuleColor[] = [
  "red",
  "yellow",
  "green",
  "blue",
  "gray",
  "orange",
  "purple",
];

export interface ColorRule {
  /** Column key (Handlebars template, e.g. "{{row.status}}") */
  column: string;
  /** Comparison operator */
  operator: ColorRuleOperator;
  /** Value to compare against */
  value: string;
  /** The color to apply when this rule matches */
  color: RuleColor;
}

export interface ColorRulesConfig {
  /** When false, rules are stored but not evaluated */
  enabled: boolean;
  /** Evaluated top-to-bottom; first match wins */
  rules: ColorRule[];
}
