import { describe, expect, it } from "vitest";
import { normalizeRut } from "./rut";

describe("normalizeRut", () => {
  it("strips dots, dashes and spaces and upper-cases the DV", () => {
    expect(normalizeRut(" 12.345.678-k ")).toBe("12345678K");
  });

  it("gives the same RUT with or without dash, dots or spaces", () => {
    expect(normalizeRut("12345678-5")).toBe("123456785");
    expect(normalizeRut("12.345.678-5")).toBe("123456785");
    expect(normalizeRut(" 12 345 678 - 5 ")).toBe("123456785");
    expect(normalizeRut("123456785")).toBe("123456785");
  });

  it("upper-cases a lowercase K verifier", () => {
    expect(normalizeRut("1000005-k")).toBe("1000005K");
  });

  it("leaves a blank RUT empty", () => {
    expect(normalizeRut("")).toBe("");
    expect(normalizeRut("  ")).toBe("");
  });
});
