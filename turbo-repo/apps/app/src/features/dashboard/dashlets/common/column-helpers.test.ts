import { describe, it, expect } from "vitest";
import { toColumnItems, fromColumnItems } from "./column-helpers";
import { makeTableColumn } from "../../test-fixtures";

describe("toColumnItems", () => {
  it("adds _id with format col-{index}-{key}", () => {
    const columns = [
      makeTableColumn({ key: "name", label: "Name", type: "text" }),
    ];
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

  it("preserves sticky when true", () => {
    const items = [
      { key: "id", label: "ID", type: "text", sticky: true, _id: "col-0-id" },
      { key: "name", label: "Name", type: "text", _id: "col-1-name" },
    ];
    const result = fromColumnItems(items);
    expect(result[0].sticky).toBe(true);
    expect(result[1].sticky).toBeUndefined();
  });

  it("omits sticky when false or undefined", () => {
    const items = [
      { key: "name", label: "Name", type: "text", sticky: false, _id: "col-0" },
    ];
    expect(fromColumnItems(items)[0].sticky).toBeUndefined();
  });
});
