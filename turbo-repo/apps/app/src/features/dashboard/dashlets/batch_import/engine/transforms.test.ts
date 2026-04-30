import { describe, it, expect } from "vitest";
import { applyTransforms, transformsForType } from "./transforms";

describe("applyTransforms", () => {
  it("returns the input unchanged when no steps", () => {
    expect(applyTransforms("hello", [])).toBe("hello");
    expect(applyTransforms("hello", undefined)).toBe("hello");
  });

  it("trims, then uppers, in pipeline order", () => {
    expect(
      applyTransforms("  abc  ", [{ kind: "trim" }, { kind: "upper" }]),
    ).toBe("ABC");
  });

  it("abs flips negative numbers", () => {
    expect(applyTransforms("-5.4", [{ kind: "abs" }])).toBe("5.4");
    expect(applyTransforms("5", [{ kind: "abs" }])).toBe("5");
    expect(applyTransforms("0", [{ kind: "abs" }])).toBe("0");
  });

  it("fixed truncates to N decimals", () => {
    expect(applyTransforms("1.9090", [{ kind: "fixed", arg: "2" }])).toBe("1.91");
    expect(applyTransforms("1.5", [{ kind: "fixed", arg: "0" }])).toBe("2");
  });

  it("clamps fixed decimals to [0, 20]", () => {
    expect(applyTransforms("1.5", [{ kind: "fixed", arg: "-3" }])).toBe("2");
    expect(applyTransforms("1.5", [{ kind: "fixed", arg: "100" }])).toBe(
      Number(1.5).toFixed(20),
    );
  });

  it("passes through non-numeric input on numeric steps unchanged", () => {
    expect(applyTransforms("abc", [{ kind: "abs" }])).toBe("abc");
    expect(applyTransforms("", [{ kind: "round" }])).toBe("0"); // empty coerces to 0 — explicit
    expect(applyTransforms("nan", [{ kind: "fixed", arg: "2" }])).toBe("nan");
  });

  it("transformsForType returns string transforms by default", () => {
    expect(transformsForType("string")).toEqual(["trim", "upper", "lower"]);
    expect(transformsForType(undefined)).toEqual(["trim", "upper", "lower"]);
  });

  it("transformsForType returns number transforms for number/integer", () => {
    expect(transformsForType("number")).toEqual(["abs", "round", "fixed"]);
    expect(transformsForType("integer")).toEqual(["abs", "round", "fixed"]);
  });
});
