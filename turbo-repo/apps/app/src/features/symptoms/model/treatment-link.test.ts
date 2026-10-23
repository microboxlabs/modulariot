import { describe, expect, it } from "vitest";
import { isEngineCaseId, treatmentHref, tripIdOf } from "./treatment-link";

describe("tripIdOf", () => {
  it("treats null, the string null and blanks as no trip", () => {
    expect(tripIdOf(null)).toBe("");
    expect(tripIdOf(undefined)).toBe("");
    expect(tripIdOf("null")).toBe("");
    expect(tripIdOf("undefined")).toBe("");
    expect(tripIdOf("  ")).toBe("");
  });

  it("keeps a real trip id", () => {
    expect(tripIdOf(" T-1 ")).toBe("T-1");
    expect(tripIdOf(42)).toBe("42");
  });
});

describe("isEngineCaseId", () => {
  it("is true only for negative ids", () => {
    expect(isEngineCaseId("-9")).toBe(true);
    expect(isEngineCaseId(-9)).toBe(true);
    expect(isEngineCaseId("9")).toBe(false);
    expect(isEngineCaseId("")).toBe(false);
    expect(isEngineCaseId(null)).toBe(false);
    expect(isEngineCaseId("-1234567890123456789")).toBe(false);
  });
});

describe("treatmentHref", () => {
  it("leaves out the trip when there is none", () => {
    expect(treatmentHref(-9, null, "DEMO008")).toBe(
      "/symptoms/map-view/-9?assetId=DEMO008"
    );
    expect(treatmentHref(-9, "null", "DEMO008")).toBe(
      "/symptoms/map-view/-9?assetId=DEMO008"
    );
  });

  it("keeps the trip and the asset of a symptom on a trip", () => {
    expect(treatmentHref(7, "T1", "AB12")).toBe(
      "/symptoms/map-view/7?tripId=T1&assetId=AB12"
    );
  });
});
