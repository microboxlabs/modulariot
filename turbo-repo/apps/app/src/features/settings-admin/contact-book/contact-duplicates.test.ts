import { describe, expect, it } from "vitest";
import {
  checkRut,
  displayRut,
  normalizeRut,
} from "./contact-duplicates";
import type { BookContact } from "./store";

const base: BookContact = { id: "a", name: "Persona Ejemplo", phone: "", role: "", methods: [] };
const contacts: BookContact[] = [
  { ...base, rut: "11.111.111-1" },
  { ...base, id: "b", name: "Ana Pérez" },
];

describe("normalizeRut", () => {
  it("strips dots, dashes and spaces and upper-cases the DV", () => {
    expect(normalizeRut(" 12.345.678-k ")).toBe("12345678K");
  });
});

describe("displayRut", () => {
  it("adds dots every three digits and the dash before the DV", () => {
    expect(displayRut("111111111")).toBe("11.111.111-1");
    expect(displayRut("1234567K")).toBe("1.234.567-K");
    expect(displayRut("123-4")).toBe("123-4");
    expect(displayRut("5")).toBe("5");
    expect(displayRut("ABCDEFG")).toBe("ABCDEF-G");
  });
});

describe("checkRut", () => {
  it("allows an empty RUT", () => {
    expect(checkRut("", contacts).problem).toBeNull();
  });

  it("flags an invalid RUT", () => {
    expect(checkRut("11.111.111-2", contacts).problem).toBe("invalid");
  });

  it("flags a RUT that another contact already has, in any format", () => {
    const check = checkRut("111111111", contacts);
    expect(check.problem).toBe("duplicate");
    expect(check.match?.id).toBe("a");
  });

  it("ignores the contact being edited", () => {
    expect(checkRut("11111111-1", contacts, "a").problem).toBeNull();
  });
});
