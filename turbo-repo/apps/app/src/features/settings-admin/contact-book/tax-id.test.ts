import { describe, expect, it } from "vitest";
import {
  displayId,
  guessCompanyIdType,
  isIdValid,
  isRucValid,
  maskId,
} from "./tax-id";

describe("maskId", () => {
  it("shapes each type while typing", () => {
    expect(maskId("RUT", "761112228")).toBe("76.111.222-8");
    expect(maskId("DNI", "1234-5678 9")).toBe("12345678");
    expect(maskId("RUC", "20 100 070 970 1")).toBe("20100070970");
    expect(maskId("CE", "ab-12345678901")).toBe("AB1234567890");
  });
});

describe("isIdValid", () => {
  it("checks RUT and RUC digits and DNI and CE lengths", () => {
    expect(isIdValid("RUT", "76.111.222-8")).toBe(true);
    expect(isIdValid("RUT", "76.111.222-3")).toBe(false);
    expect(isIdValid("RUC", "20100070970")).toBe(true);
    expect(isIdValid("RUC", "20100070971")).toBe(false);
    expect(isIdValid("DNI", "12345678")).toBe(true);
    expect(isIdValid("DNI", "1234567")).toBe(false);
    expect(isIdValid("CE", "001234567")).toBe(true);
    expect(isIdValid("PASAPORTE", "X123")).toBe(true);
  });

  it("knows a RUC only starts with 10, 15, 17 or 20", () => {
    expect(isRucValid("30100070970")).toBe(false);
  });
});

describe("displayId and guessCompanyIdType", () => {
  it("formats only a RUT and tells a carrier's RUT from a RUC", () => {
    expect(displayId("RUT", "761112228")).toBe("76.111.222-8");
    expect(displayId(undefined, "761112228")).toBe("76.111.222-8");
    expect(displayId("RUC", "20100070970")).toBe("20100070970");
    expect(guessCompanyIdType("76.111.222-8")).toBe("RUT");
    expect(guessCompanyIdType("20100070970")).toBe("RUC");
    expect(guessCompanyIdType("123")).toBe("OTRO");
  });
});
