import { describe, expect, it } from "vitest";
import { parseCount } from "./team-settings-modal";

describe("parseCount", () => {
  it("reads empty as not set", () => {
    expect(parseCount("  ", 0, 10)).toEqual({ ok: true, value: null });
  });

  it("accepts whole numbers inside the bounds", () => {
    expect(parseCount("0", 0, 10)).toEqual({ ok: true, value: 0 });
    expect(parseCount(" 10 ", 0, 10)).toEqual({ ok: true, value: 10 });
  });

  it("rejects decimals, signs, text and values out of bounds", () => {
    for (const raw of ["1.5", "-1", "+3", "1e3", "abc", "11"]) {
      expect(parseCount(raw, 0, 10).ok).toBe(false);
    }
    expect(parseCount("0", 1, 24).ok).toBe(false);
  });
});
