import { describe, it, expect } from "vitest";
import { isColumnType, COLUMN_TYPES } from "./column-types";

describe("isColumnType", () => {
  it.each(COLUMN_TYPES)('returns true for valid type "%s"', (type) => {
    expect(isColumnType(type)).toBe(true);
  });

  it("returns false for unknown string", () => {
    expect(isColumnType("unknown")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isColumnType("")).toBe(false);
  });
});
