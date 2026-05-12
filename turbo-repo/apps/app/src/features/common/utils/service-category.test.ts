import { describe, it, expect } from "vitest";
import { serviceCategoryInitials } from "./service-category";

describe("serviceCategoryInitials", () => {
  it("returns the initials of a two-word name", () => {
    expect(serviceCategoryInitials("Servicio Programado")).toBe("SP");
  });

  it("uppercases the result", () => {
    expect(serviceCategoryInitials("carga peligrosa")).toBe("CP");
  });

  it("uses only the first two words for longer names", () => {
    expect(serviceCategoryInitials("Transporte de Carga General")).toBe("TD");
  });

  it("collapses extra whitespace", () => {
    expect(serviceCategoryInitials("  carga   peligrosa ")).toBe("CP");
  });

  it("preserves accented initials", () => {
    expect(serviceCategoryInitials("Útil Programado")).toBe("ÚP");
  });

  it("falls back to the first two characters for a single word", () => {
    expect(serviceCategoryInitials("Faena")).toBe("FA");
  });

  it("returns the single character for a one-letter word", () => {
    expect(serviceCategoryInitials("X")).toBe("X");
  });

  it("returns an empty string for empty or nullish input", () => {
    expect(serviceCategoryInitials("")).toBe("");
    expect(serviceCategoryInitials("   ")).toBe("");
    expect(serviceCategoryInitials(null)).toBe("");
    expect(serviceCategoryInitials(undefined)).toBe("");
  });
});
