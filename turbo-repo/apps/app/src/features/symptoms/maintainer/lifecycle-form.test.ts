import { describe, expect, it } from "vitest";
import {
  compileClose,
  compileOpen,
  parseClose,
  parseOpen,
} from "./lifecycle-form";

describe("open", () => {
  it("reads instant and sustained, and writes them back", () => {
    expect(parseOpen("caso.condicion_s >= 0")).toEqual({ kind: "instant" });
    expect(parseOpen("caso.condicion_s>=30")).toEqual({
      kind: "sustained",
      seconds: 30,
    });
    expect(compileOpen({ kind: "instant" })).toBe("caso.condicion_s >= 0");
    expect(compileOpen({ kind: "sustained", seconds: 30 })).toBe(
      "caso.condicion_s >= 30"
    );
  });

  it("returns null for anything else", () => {
    for (const rule of [
      "",
      null,
      "caso.condicion_s > 0",
      "caso.condicion_s >= -5",
      "caso.condicion_s >= 0 && caso.nivel > 1",
      "caso.condicion_s >= 1e3",
      "true",
    ]) {
      expect(parseOpen(rule), String(rule)).toBeNull();
    }
  });
});

describe("close", () => {
  it("reads every kind and writes it back", () => {
    for (const rule of [
      "caso.normal_s >= 120",
      "caso.cerrado_por_operador",
      "caso.edad_h >= 12",
    ]) {
      expect(compileClose(parseClose(rule)!)).toBe(rule);
    }
    expect(parseClose("caso.normal_s >= 120")).toEqual({
      kind: "normal",
      minutes: 2,
    });
    expect(parseClose("caso.cerrado_por_operador == true")).toEqual({
      kind: "operator",
    });
    expect(parseClose("caso.edad_h >= 0.5")).toEqual({
      kind: "expire",
      hours: 0.5,
    });
    expect(compileClose({ kind: "normal", minutes: 0.5 })).toBe(
      "caso.normal_s >= 30"
    );
    expect(compileClose(parseClose("caso.normal_s >= 7")!)).toBe(
      "caso.normal_s >= 7"
    );
    for (const minutes of [0.5, 1.5, 0.1, 2, 90]) {
      const rule = compileClose({ kind: "normal", minutes });
      expect(parseClose(rule), rule).toEqual({ kind: "normal", minutes });
    }
  });

  it("returns null for anything else", () => {
    for (const rule of [
      "",
      "caso.normal_s > 120",
      "caso.edad_h >= 0",
      "caso.normal_s >= 120 || caso.cerrado_por_operador",
      "!caso.cerrado_por_operador",
      "caso.edad_h >= 9007199254740993",
    ]) {
      expect(parseClose(rule), rule).toBeNull();
    }
  });
});
