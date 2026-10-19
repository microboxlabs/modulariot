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

it("sorts threshold slots across intervening equality rules", () => {
  const rules: ComparableRule[] = [
    {
      operator: "greater_than",
      value: "10",
      color: "yellow",
      targets: ["text"],
    },
    { operator: "equals", value: "999", color: "blue", targets: ["text"] },
    { operator: "greater_than", value: "35", color: "red", targets: ["text"] },
  ];
  expect(sortColorRules(rules).map((r) => r.value)).toEqual([
    "35",
    "999",
    "10",
  ]);
  expect(evaluateColorRulesGeneric(rules, "50", ["text"])).toEqual({
    text: "red",
  });
  const fields = rules.map((r, i) => ({
    ...r,
    compareMode: "field" as const,
    compareField: String(i),
  }));
  expect(
    evaluateColorRulesWithFields(fields, "50", { "0": 10, "1": 999, "2": 35 }, [
      "text",
    ]),
  ).toEqual({ text: "red" });
  expect(rules.map((r) => r.value)).toEqual(["10", "999", "35"]);
});
it("preserves empty first-match tokens and supports own-property target names", () => {
  const rules: ComparableRule[] = [
    {
      operator: "equals",
      value: "1",
      color: "",
      targets: ["text", "__proto__", "constructor"],
    },
    {
      operator: "equals",
      value: "1",
      color: "red",
      targets: ["text", "__proto__", "constructor"],
    },
  ];
  for (const result of [
    evaluateColorRulesGeneric(rules, "1", ["text", "__proto__", "constructor"]),
    evaluateColorRulesWithFields(rules, "1", {}, [
      "text",
      "__proto__",
      "constructor",
    ]),
  ]) {
    expect(Object.keys(result)).toEqual(["text", "__proto__", "constructor"]);
    expect(result.text).toBe("");
    expect(result.__proto__).toBe("");
    expect(result.constructor).toBe("");
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  }
});
