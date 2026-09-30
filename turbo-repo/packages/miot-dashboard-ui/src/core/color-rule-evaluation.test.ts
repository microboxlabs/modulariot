import { expect, it } from "vitest";
import {
  evaluateColorRulesGeneric,
  evaluateColorRulesWithFields,
  sortColorRules,
  getCompareValue,
  type ComparableRule,
} from "./color-rule-evaluation";
it("keeps the strongest matching thresholds per target without mutating input", () => {
  const rules: ComparableRule[] = [
    {
      operator: "greater_than",
      value: "10",
      color: "yellow",
      targets: ["text", "icon"],
    },
    {
      operator: "less_than_or_equal",
      value: "10",
      color: "green",
      targets: ["text"],
    },
    { operator: "greater_than", value: "35", color: "red", targets: ["text"] },
  ];
  expect(sortColorRules(rules).map((r) => r.value)).toEqual(["35", "10", "10"]);
  expect(
    evaluateColorRulesGeneric(rules, "50", ["text", "icon", "background"]),
  ).toEqual({ text: "red", icon: "yellow" });
  expect(rules[0]?.color).toBe("yellow");
  expect(evaluateColorRulesGeneric(rules, "bad", ["text"])).toEqual({});
});
it("compares named fields and preserves missing-field fallback", () => {
  const rule: ComparableRule = {
    operator: "greater_than",
    value: "999",
    color: "red",
    targets: ["text"],
    compareMode: "field",
    compareField: "budget",
  };
  expect(getCompareValue(rule, { budget: 10 })).toBe("10");
  expect(
    evaluateColorRulesWithFields([rule], "12", { budget: 10 }, ["text"]),
  ).toEqual({ text: "red" });
  expect(
    evaluateColorRulesWithFields([rule], "12", { budget: 20 }, ["text"]),
  ).toEqual({});
  expect(getCompareValue(rule, {})).toBe("0");
  expect(
    getCompareValue({ ...rule, compareField: undefined }, { previousValue: 5 }),
  ).toBe("5");
  expect(
    getCompareValue({ ...rule, compareMode: "static" }, { budget: 10 }),
  ).toBe("999");
});
it("sorts less-than thresholds ascending and leaves an empty target set empty", () => {
  const rules: ComparableRule[] = [
    { operator: "less_than", value: "100", color: "blue", targets: ["text"] },
    { operator: "less_than", value: "10", color: "green", targets: ["text"] },
  ];
  expect(evaluateColorRulesGeneric(rules, "5", ["text"])).toEqual({
    text: "green",
  });
  expect(evaluateColorRulesGeneric(rules, "5", [])).toEqual({});
});
