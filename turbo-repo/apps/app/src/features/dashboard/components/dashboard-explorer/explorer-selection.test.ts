import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  nextSelection,
  selectModeOf,
} from "./explorer-selection";

const order = ["a", "b", "c", "d"];

describe("explorer selection", () => {
  it("reads the mode from the click's modifier keys", () => {
    const plain = { shiftKey: false, metaKey: false, ctrlKey: false };
    expect(selectModeOf(plain)).toBe("single");
    expect(selectModeOf({ ...plain, metaKey: true })).toBe("toggle");
    expect(selectModeOf({ ...plain, ctrlKey: true })).toBe("toggle");
    expect(selectModeOf({ ...plain, shiftKey: true })).toBe("range");
  });

  it("selects one item on a plain click", () => {
    const selection = nextSelection(
      { ids: ["a", "b"], anchorId: "a" },
      "c",
      "single",
      order
    );
    expect(selection).toEqual({ ids: ["c"], anchorId: "c" });
  });

  it("adds and removes with Ctrl/⌘-click", () => {
    let selection = nextSelection(EMPTY_SELECTION, "a", "single", order);
    selection = nextSelection(selection, "c", "toggle", order);
    expect(selection.ids).toEqual(["a", "c"]);
    selection = nextSelection(selection, "a", "toggle", order);
    expect(selection.ids).toEqual(["c"]);
  });

  it("selects a range with Shift-click, either direction", () => {
    const fromB = nextSelection(EMPTY_SELECTION, "b", "single", order);
    expect(nextSelection(fromB, "d", "range", order).ids).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(nextSelection(fromB, "a", "range", order).ids).toEqual(["a", "b"]);
  });
});
