import { describe, it, expect } from "vitest";
import { toFilterItems, fromFilterItems, normalizeFilterConfig } from "./filter-helpers";
import { makeFilterItemConfig, makeFilterConfig } from "../../test-fixtures";

describe("toFilterItems", () => {
  it("adds _id with format fi-{index}-{column}", () => {
    const items = [makeFilterItemConfig({ column: "status", label: "Status" })];
    const result = toFilterItems(items);
    expect(result).toEqual([
      { column: "status", label: "Status", _id: "fi-0-status" },
    ]);
  });

  it("preserves column and label for multiple items", () => {
    const items = [
      makeFilterItemConfig({ column: "a", label: "A" }),
      makeFilterItemConfig({ column: "b", label: "B" }),
    ];
    const result = toFilterItems(items);
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe("fi-0-a");
    expect(result[1]._id).toBe("fi-1-b");
  });

  it("handles empty array", () => {
    expect(toFilterItems([])).toEqual([]);
  });
});

describe("fromFilterItems", () => {
  it("strips _id, returns column and label only", () => {
    const items = [{ column: "status", label: "Status", _id: "fi-0-status" }];
    expect(fromFilterItems(items)).toEqual([{ column: "status", label: "Status" }]);
  });

  it("handles empty array", () => {
    expect(fromFilterItems([])).toEqual([]);
  });
});

describe("normalizeFilterConfig", () => {
  const fallback = makeFilterConfig({ enabled: false, items: [] });

  it("returns fallback for null input", () => {
    expect(normalizeFilterConfig(null, fallback)).toBe(fallback);
  });

  it("returns fallback for undefined input", () => {
    expect(normalizeFilterConfig(undefined, fallback)).toBe(fallback);
  });

  it("returns fallback for non-object input", () => {
    expect(normalizeFilterConfig("string", fallback)).toBe(fallback);
  });

  it("extracts enabled boolean from raw", () => {
    const raw = { enabled: true, items: [{ column: "a", label: "A" }] };
    const result = normalizeFilterConfig(raw, fallback);
    expect(result.enabled).toBe(true);
  });

  it("falls back to fallback.enabled when enabled is not boolean", () => {
    const raw = { enabled: "yes", items: [{ column: "a", label: "A" }] };
    const result = normalizeFilterConfig(raw, fallback);
    expect(result.enabled).toBe(fallback.enabled);
  });

  it("normalizes valid items array", () => {
    const raw = { enabled: true, items: [{ column: "a", label: "A" }] };
    const result = normalizeFilterConfig(raw, fallback);
    expect(result.items).toEqual([{ column: "a", label: "A" }]);
  });

  it("filters out items missing column string", () => {
    const raw = {
      enabled: true,
      items: [
        { column: "a", label: "A" },
        { label: "No column" },
        { column: "", label: "Empty" },
      ],
    };
    const result = normalizeFilterConfig(raw, fallback);
    expect(result.items).toEqual([{ column: "a", label: "A" }]);
  });

  it("defaults label to empty string when not a string", () => {
    const raw = { enabled: true, items: [{ column: "a", label: 123 }] };
    const result = normalizeFilterConfig(raw, fallback);
    expect(result.items).toEqual([{ column: "a", label: "" }]);
  });

  it("returns fallback when items array is empty after filtering", () => {
    const raw = { enabled: true, items: [{ label: "bad" }] };
    expect(normalizeFilterConfig(raw, fallback)).toBe(fallback);
  });

  it("converts legacy shape { enabled, column, label }", () => {
    const raw = { enabled: true, column: "status", label: "Status" };
    const result = normalizeFilterConfig(raw, fallback);
    expect(result).toEqual({
      enabled: true,
      items: [{ column: "status", label: "Status" }],
    });
  });

  it("returns fallback when legacy column is empty string", () => {
    const raw = { enabled: true, column: "", label: "Empty" };
    expect(normalizeFilterConfig(raw, fallback)).toBe(fallback);
  });

  it("returns fallback when legacy column is missing", () => {
    const raw = { enabled: true, label: "No column" };
    expect(normalizeFilterConfig(raw, fallback)).toBe(fallback);
  });
});
