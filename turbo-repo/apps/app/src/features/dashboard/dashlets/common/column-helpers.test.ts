import { describe, it, expect } from "vitest";
import { toColumnItems, fromColumnItems } from "./column-helpers";
import { makeTableColumn } from "../../test-fixtures";

describe("toColumnItems", () => {
  it("adds _id with format col-{index}-{key}", () => {
    const columns = [makeTableColumn({ key: "name", label: "Name", type: "text" })];
    const result = toColumnItems(columns);
    expect(result).toEqual([
      { key: "name", label: "Name", type: "text", _id: "col-0-name" },
    ]);
  });

  it("handles multiple columns", () => {
    const columns = [
      makeTableColumn({ key: "a" }),
      makeTableColumn({ key: "b" }),
    ];
    const result = toColumnItems(columns);
    expect(result[0]._id).toBe("col-0-a");
    expect(result[1]._id).toBe("col-1-b");
  });

  it("handles empty array", () => {
    expect(toColumnItems([])).toEqual([]);
  });
});

describe("fromColumnItems", () => {
  it("strips _id, returns key, label, type", () => {
    const items = [
      { key: "name", label: "Name", type: "text", _id: "col-0-name" },
    ];
    expect(fromColumnItems(items)).toEqual([
      { key: "name", label: "Name", type: "text" },
    ]);
  });

  it("handles empty array", () => {
    expect(fromColumnItems([])).toEqual([]);
  });
});
