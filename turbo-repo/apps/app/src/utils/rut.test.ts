import { describe, expect, it } from "vitest";
import { normalizeRut } from "./rut";

describe("normalizeRut", () => {
  it("strips dots, dashes and spaces and upper-cases the DV", () => {
    expect(normalizeRut(" 00.000.002-k ")).toBe("00000002K");
  });

  it("gives the same RUT with or without dash, dots or spaces", () => {
    expect(normalizeRut("00000001-9")).toBe("000000019");
    expect(normalizeRut("00.000.001-9")).toBe("000000019");
    expect(normalizeRut(" 00 000 001 - 9 ")).toBe("000000019");
    expect(normalizeRut("000000019")).toBe("000000019");
    expect(normalizeRut("\u00a000.000.001-9\u00a0")).toBe("000000019");
    expect(normalizeRut("\ufeff00.000.001-9\u202f")).toBe("000000019");
  });

  it("upper-cases a lowercase K verifier", () => {
    expect(normalizeRut("00000002-k")).toBe("00000002K");
  });

  it("leaves a blank RUT empty", () => {
    expect(normalizeRut("")).toBe("");
    expect(normalizeRut("  ")).toBe("");
    expect(normalizeRut(" . - \t ")).toBe("");
    expect(normalizeRut("\u00a0\u202f\ufeff")).toBe("");
  });
});
