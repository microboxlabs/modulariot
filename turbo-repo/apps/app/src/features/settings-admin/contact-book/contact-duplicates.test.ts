import { describe, expect, it } from "vitest";
import {
  checkRut,
  displayRut,
  maskRut,
  normalizeRut,
} from "./contact-duplicates";
import type { BookContact } from "./store";

const base: BookContact = {
  id: "a",
  name: "Persona Ejemplo",
  phone: "",
  role: "",
  methods: [],
};
const contacts: BookContact[] = [
  { ...base, rut: "11.111.111-1" },
  { ...base, id: "b", name: "Ana Pérez" },
];

describe("normalizeRut", () => {
  it("strips dots, dashes and spaces and upper-cases the DV", () => {
    expect(normalizeRut(" 12.345.678-k ")).toBe("12345678K");
  });
});

describe("maskRut", () => {
  it("formats while typing and keeps K only as the check digit", () => {
    expect(maskRut("1")).toBe("1");
    expect(maskRut("12345")).toBe("1.234-5");
    expect(maskRut("761112228")).toBe("76.111.222-8");
    expect(maskRut("76.111.222-8")).toBe("76.111.222-8");
    expect(maskRut("1234567k")).toBe("1.234.567-K");
    expect(maskRut("12k45")).toBe("124-5");
    expect(maskRut("7611122289999")).toBe("76.111.222-8");
    expect(maskRut("ab")).toBe("");
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
