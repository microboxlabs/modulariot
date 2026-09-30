import type { ColorRuleOperator } from "../core/color-rules";
const operators = new Set<string>([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "greater_than",
  "less_than",
  "greater_than_or_equal",
  "less_than_or_equal",
]);
export function normalizeScalarColorRules(raw: unknown) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !("rules" in raw) ||
    !Array.isArray(raw.rules)
  )
    return [];
  return raw.rules.flatMap((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== "object" ||
      !("operator" in entry) ||
      typeof entry.operator !== "string" ||
      !operators.has(entry.operator) ||
      !("color" in entry) ||
      typeof entry.color !== "string" ||
      !/^(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(entry.color)
    )
      return [];
    return [
      {
        operator: entry.operator as ColorRuleOperator,
        color: entry.color,
        value:
          "value" in entry && typeof entry.value === "string"
            ? entry.value
            : "",
      },
    ];
  });
}
