import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECURRENCE,
  toggleRecurrence,
  wholeNumber,
} from "./recurrence-form";

describe("wholeNumber", () => {
  it("reads whole numbers and treats empty or junk as 0", () => {
    expect(wholeNumber("7")).toBe(7);
    expect(wholeNumber("2.9")).toBe(2);
    expect(wholeNumber("")).toBe(0);
    expect(wholeNumber("-")).toBe(0);
    expect(wholeNumber("-3")).toBe(-3);
  });
});

describe("toggleRecurrence", () => {
  it("starts from the defaults when the symptom has none", () => {
    expect(toggleRecurrence(null, true)).toEqual(DEFAULT_RECURRENCE);
  });

  it("keeps the numbers when turned off and back on", () => {
    const custom = {
      enabled: true,
      count: 5,
      days: 30,
      raiseLevels: 2,
      entity: "conductor",
    };
    const off = toggleRecurrence(custom, false);
    expect(off).toEqual({ ...custom, enabled: false });
    expect(toggleRecurrence(off, true)).toEqual(custom);
  });
});
