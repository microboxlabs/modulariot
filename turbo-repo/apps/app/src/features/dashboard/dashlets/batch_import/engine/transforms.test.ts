import { describe, it, expect } from "vitest";
import dayjs from "dayjs";
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

  it("transformsForType returns date transforms when format is date/date-time", () => {
    expect(transformsForType(undefined, "date")).toEqual([
      "dateOnly",
      "startOfDay",
      "toUTC",
    ]);
    expect(transformsForType("string", "date-time")).toEqual([
      "dateOnly",
      "startOfDay",
      "toUTC",
    ]);
  });

  it("dateOnly returns the local-day portion as YYYY-MM-DD", () => {
    // Use noon UTC so any reasonable host TZ resolves to the same calendar day.
    const input = "2026-03-15T12:00:00.000Z";
    const expected = dayjs(input).format("YYYY-MM-DD");
    expect(applyTransforms(input, [{ kind: "dateOnly" }])).toBe(expected);
    expect(applyTransforms("2026-03-15", [{ kind: "dateOnly" }])).toBe(
      "2026-03-15",
    );
  });

  it("startOfDay returns a valid ISO string at the local midnight", () => {
    const input = "2026-03-15T12:34:56.789Z";
    const out = applyTransforms(input, [{ kind: "startOfDay" }]);
    // Re-parse and verify the wall-clock time-of-day collapses to midnight
    // in whatever TZ the host runs in — tying the assertion to behaviour,
    // not to a specific Z-encoded representation.
    const reparsed = dayjs(out);
    expect(reparsed.isValid()).toBe(true);
    expect(reparsed.hour()).toBe(0);
    expect(reparsed.minute()).toBe(0);
    expect(reparsed.second()).toBe(0);
    expect(reparsed.millisecond()).toBe(0);
  });

  it("toUTC normalizes an offset timestamp to a Z-suffixed ISO string", () => {
    expect(
      applyTransforms("2026-03-01T12:27:45+02:00", [{ kind: "toUTC" }]),
    ).toBe("2026-03-01T10:27:45.000Z");
  });

  it("date transforms pass through invalid input unchanged", () => {
    expect(applyTransforms("not-a-date", [{ kind: "dateOnly" }])).toBe(
      "not-a-date",
    );
    expect(applyTransforms("", [{ kind: "startOfDay" }])).toBe("");
    expect(applyTransforms("xyz", [{ kind: "toUTC" }])).toBe("xyz");
  });
});
