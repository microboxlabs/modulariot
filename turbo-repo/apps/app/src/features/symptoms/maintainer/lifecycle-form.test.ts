import { describe, expect, it } from "vitest";
import {
  compileClose,
  compileOpen,
  parseClose,
  parseOpen,
} from "./lifecycle-form";

describe("open", () => {
  it("reads instant and sustained, and writes them back", () => {
    expect(parseOpen("case.condition_s >= 0")).toEqual({ kind: "instant" });
    expect(parseOpen("case.condition_s>=30")).toEqual({
      kind: "sustained",
      seconds: 30,
    });
    expect(compileOpen({ kind: "instant" })).toBe("case.condition_s >= 0");
    expect(compileOpen({ kind: "sustained", seconds: 30 })).toBe(
      "case.condition_s >= 30"
    );
  });

  it("returns null for anything else", () => {
    for (const rule of [
      "",
      null,
      "case.condition_s > 0",
      "case.condition_s >= -5",
      "case.condition_s >= 0 && case.level > 1",
      "case.condition_s >= 1e3",
      "true",
    ]) {
      expect(parseOpen(rule), String(rule)).toBeNull();
    }
  });
});

describe("close", () => {
  it("reads every kind and writes it back", () => {
    for (const rule of [
      "case.normal_s >= 120",
      "case.closed_by_operator",
      "case.age_h >= 12",
    ]) {
      expect(compileClose(parseClose(rule)!)).toBe(rule);
    }
    expect(parseClose("case.normal_s >= 120")).toEqual({
      kind: "normal",
      minutes: 2,
    });
    expect(parseClose("case.closed_by_operator == true")).toEqual({
      kind: "operator",
    });
    expect(parseClose("case.age_h >= 0.5")).toEqual({
      kind: "expire",
      hours: 0.5,
    });
    expect(compileClose({ kind: "normal", minutes: 0.5 })).toBe(
      "case.normal_s >= 30"
    );
    expect(compileClose(parseClose("case.normal_s >= 7")!)).toBe(
      "case.normal_s >= 7"
    );
    for (const minutes of [0.5, 1.5, 0.1, 2, 90]) {
      const rule = compileClose({ kind: "normal", minutes });
      expect(parseClose(rule), rule).toEqual({ kind: "normal", minutes });
    }
  });

  it("returns null for anything else", () => {
    for (const rule of [
      "",
      "case.normal_s > 120",
      "case.age_h >= 0",
      "case.normal_s >= 120 || case.closed_by_operator",
      "!case.closed_by_operator",
      "case.age_h >= 9007199254740993",
    ]) {
      expect(parseClose(rule), rule).toBeNull();
    }
  });
});
