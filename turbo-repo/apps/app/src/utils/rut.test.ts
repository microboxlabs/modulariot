import { describe, expect, it } from "vitest";
import { normalizeRut } from "./rut";

describe("normalizeRut", () => {
  it("strips dots, dashes and spaces and upper-cases the DV", () => {
    expect(normalizeRut(" 12.345.678-k ")).toBe("12345678K");
  });

  it("gives the same RUT with or without dash", () => {
    expect(normalizeRut("11111111-1")).toBe("111111111");
    expect(normalizeRut("111111111")).toBe("111111111");
  });

  it("leaves a blank RUT empty", () => {
    expect(normalizeRut("  ")).toBe("");
  });
});
