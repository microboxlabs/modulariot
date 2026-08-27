import { describe, it, expect } from "vitest";
import { dayPart } from "./date-param";

describe("dayPart", () => {
  it("strips a space-separated time, the format this app emits", () => {
    expect(dayPart("2026-08-26 23:59:59")).toBe("2026-08-26");
  });

  it("strips an ISO T-separated time", () => {
    // A chained split(" ") then split("T") never reaches the second branch:
    // a value with no space comes back whole from the first.
    expect(dayPart("2026-08-26T15:30:00")).toBe("2026-08-26");
  });

  it("leaves a bare date untouched", () => {
    expect(dayPart("2026-08-26")).toBe("2026-08-26");
  });

  it("returns an empty string unchanged", () => {
    expect(dayPart("")).toBe("");
  });
});
