import { describe, expect, it } from "vitest";
import { compileThresholds, parseThresholds } from "./level-thresholds";

describe("parseThresholds", () => {
  it("reads every platform template level and writes it back unchanged", () => {
    for (const rule of [
      "medida > 0 && medida < 5",
      "medida >= 5 && medida < 10",
      "medida >= 20 && sostenido_s >= 60",
      "sostenido_s < 600",
      "sostenido_s >= 600 && sostenido_s < 1200",
      "sostenido_s >= 1800",
      "medida >= 360",
      "true",
    ]) {
      const t = parseThresholds(rule);
      expect(t, rule).not.toBeNull();
      expect(compileThresholds(t!)).toBe(rule);
    }
  });

  it("reads bounds by side, whatever their order", () => {
    expect(
      parseThresholds("sostenido_s >= 60 && medida < 5 && medida >= 1.5")
    ).toEqual({
      measure: {
        lower: { op: ">=", value: 1.5 },
        upper: { op: "<", value: 5 },
      },
      held: { lower: { op: ">=", value: 60 }, upper: null },
    });
    expect(
      compileThresholds(parseThresholds("medida <= 5 && medida > 1")!)
    ).toBe("medida > 1 && medida <= 5");
  });

  it("reads an empty rule as no bounds", () => {
    expect(compileThresholds(parseThresholds("")!)).toBe("true");
    expect(compileThresholds(parseThresholds(null)!)).toBe("true");
  });

  it("returns null for rules the form cannot show", () => {
    for (const rule of [
      "medida > 0 || medida < 5", // o
      "medida > 0 && medida > 5", // two lower bounds
      "medida < 5 && medida <= 3", // two upper bounds
      "(medida > 0)", // parentheses
      "medida == 5", // equality
      "signal.gps.speed_kmh > 90", // a source field
      "medida > sostenido_s", // variable against variable
      "medida > 9007199254740993", // a number the form cannot keep
      "!(medida > 3)", // negation
      "5 < medida", // reversed
    ]) {
      expect(parseThresholds(rule), rule).toBeNull();
    }
  });
});
