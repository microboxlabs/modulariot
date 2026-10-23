import { describe, expect, it } from "vitest";
import {
  compileThresholds,
  DEFAULT_LEVEL_RULE,
  parseThresholds,
} from "./level-thresholds";

describe("parseThresholds", () => {
  it("reads the rule a level gets when it is turned on", () => {
    expect(parseThresholds(DEFAULT_LEVEL_RULE)).not.toBeNull();
  });

  it("reads every platform template level and writes it back unchanged", () => {
    for (const rule of [
      "measure > 0 && measure < 5",
      "measure >= 5 && measure < 10",
      "measure >= 20 && held_s >= 60",
      "held_s < 600",
      "held_s >= 600 && held_s < 1200",
      "held_s >= 1800",
      "measure >= 360",
      "true",
    ]) {
      const t = parseThresholds(rule);
      expect(t, rule).not.toBeNull();
      expect(compileThresholds(t!)).toBe(rule);
    }
  });

  it("reads bounds by side, whatever their order", () => {
    expect(
      parseThresholds("held_s >= 60 && measure < 5 && measure >= 1.5")
    ).toEqual({
      measure: {
        lower: { op: ">=", value: 1.5 },
        upper: { op: "<", value: 5 },
      },
      held: { lower: { op: ">=", value: 60 }, upper: null },
    });
    expect(
      compileThresholds(parseThresholds("measure <= 5 && measure > 1")!)
    ).toBe("measure > 1 && measure <= 5");
  });

  it("reads true as no bounds and leaves a blank rule to the validator", () => {
    expect(compileThresholds(parseThresholds("true")!)).toBe("true");
    expect(parseThresholds("")).toBeNull();
    expect(parseThresholds("   ")).toBeNull();
    expect(parseThresholds(null)).toBeNull();
  });

  it("reads an exact value and writes it back", () => {
    const t = parseThresholds("measure == 1000 && held_s >= 60");
    expect(t?.measure).toEqual({
      lower: { op: "==", value: 1000 },
      upper: null,
    });
    expect(t && compileThresholds(t)).toBe("measure == 1000 && held_s >= 60");
  });

  it("returns null for rules the form cannot show", () => {
    for (const rule of [
      "measure > 0 || measure < 5", // o
      "measure > 0 && measure > 5", // two lower bounds
      "measure < 5 && measure <= 3", // two upper bounds
      "(measure > 0)", // parentheses
      "measure == 5 && measure < 9", // an exact value with another bound
      "signal.frame.gps.speed > 90", // a source field
      "measure > held_s", // variable against variable
      "measure > 9007199254740993", // a number the form cannot keep
      "!(measure > 3)", // negation
      "5 < measure", // reversed
      "held_s == 60", // an exact hold time is never reached
    ]) {
      expect(parseThresholds(rule), rule).toBeNull();
    }
  });
});
