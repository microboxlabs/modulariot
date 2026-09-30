import { describe, expect, it, vi } from "vitest";
import {
  evaluateRule,
  findMatchingColor,
  type ColorRuleOperator,
} from "./color-rules";
const rule = (operator: ColorRuleOperator, value: string, color = "red") => ({
  column: "status",
  operator,
  value,
  color,
});
describe("legacy-compatible color comparisons", () => {
  it.each([
    ["equals", "12", "$12 USD", true],
    ["equals", " READY ", "ready", true],
    ["not_equals", "12", "13", true],
    ["not_equals", "READY", "ready", false],
    ["contains", "AD", "ready", true],
    ["not_contains", "AD", "ready", false],
    ["greater_than", "10", "$12 USD", true],
    ["less_than", "10", "-2", true],
    ["greater_than_or_equal", "12", "12", true],
    ["less_than_or_equal", "12", "12", true],
    ["greater_than", "invalid", "12", false],
    ["less_than", "12", "invalid", false],
  ] as const)(
    "%s compares %s with %s",
    (operator, comparison, cell, expected) => {
      expect(evaluateRule(rule(operator, comparison), cell)).toBe(expected);
    },
  );
  it("preserves first-match order and supplies row context to the resolver", () => {
    const row = { status: "ready" };
    const resolve = vi.fn(
      (key: string, data: Record<string, string>) => data[key] ?? "",
    );
    const rules = [
      rule("equals", "READY", "00ff00"),
      rule("contains", "read", "blue"),
    ];
    expect(findMatchingColor(rules, row, resolve, 2, 10)).toBe("00ff00");
    expect(resolve).toHaveBeenCalledExactlyOnceWith("status", row, 2, 10);
    expect(
      findMatchingColor(rules, { status: "waiting" }, resolve, 0, 1),
    ).toBeNull();
    expect(rules[0]?.color).toBe("00ff00");
  });
});
