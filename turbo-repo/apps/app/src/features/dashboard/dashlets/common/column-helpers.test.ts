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

  it("preserves descriptionEnabled when true", () => {
    const items = [
      {
        key: "status",
        label: "Status",
        type: "badge",
        descriptionEnabled: true,
        description: "**Bold** description",
        _id: "col-0-status",
      },
    ];
    const result = fromColumnItems(items);
    expect(result[0].descriptionEnabled).toBe(true);
    expect(result[0].description).toBe("**Bold** description");
  });

  it("omits descriptionEnabled when false or undefined", () => {
    const items = [
      { key: "name", label: "Name", type: "text", descriptionEnabled: false, _id: "col-0" },
      { key: "id", label: "ID", type: "text", _id: "col-1" },
    ];
    const result = fromColumnItems(items);
    expect(result[0].descriptionEnabled).toBeUndefined();
    expect(result[1].descriptionEnabled).toBeUndefined();
  });

  it("preserves description when present", () => {
    const items = [
      {
        key: "status",
        label: "Status",
        type: "badge",
        description: "**Bold** description",
        _id: "col-0-status",
      },
    ];
    const result = fromColumnItems(items);
    expect(result[0].description).toBe("**Bold** description");
  });

  it("omits description when empty or undefined", () => {
    const items = [
      { key: "name", label: "Name", type: "text", description: "", _id: "col-0" },
      { key: "id", label: "ID", type: "text", _id: "col-1" },
    ];
    const result = fromColumnItems(items);
    expect(result[0].description).toBeUndefined();
    expect(result[1].description).toBeUndefined();
  });

  it("round-trips description through toColumnItems and fromColumnItems", () => {
    const columns = [
      makeTableColumn({
        key: "col",
        label: "Col",
        type: "text",
        description: "Some markdown **text**",
      }),
    ];
    const items = toColumnItems(columns);
    expect(items[0].description).toBe("Some markdown **text**");
    const result = fromColumnItems(items);
    expect(result[0].description).toBe("Some markdown **text**");
  });
});
