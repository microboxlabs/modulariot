import { describe, it, expect } from "vitest";
import { getNextPosition } from "./dashboard-context";
import { GRID_COLS } from "../types/dashboard.types";
import { makeWidget, makeLayout } from "../test-fixtures";

describe("getNextPosition", () => {
  it("returns {x:0, y:0} for empty children array", () => {
    expect(getNextPosition([])).toEqual({ x: 0, y: 0 });
  });

  it("places next to last widget when space available", () => {
    const children = [
      makeWidget({ layout: makeLayout({ x: 0, y: 0, w: 6, h: 4 }) }),
    ];
    const pos = getNextPosition(children, 6);
    // lastRowY = maxBottom - 1 = 4 - 1 = 3
    expect(pos).toEqual({ x: 6, y: 3 });
  });

  it("starts new row when last row is full", () => {
    const children = [
      makeWidget({ layout: makeLayout({ x: 0, y: 0, w: GRID_COLS, h: 2 }) }),
    ];
    const pos = getNextPosition(children, 6);
    expect(pos).toEqual({ x: 0, y: 2 });
  });

  it("places next to multiple widgets in same row", () => {
    const children = [
      makeWidget({
        id: "w1",
        layout: makeLayout({ i: "w1", x: 0, y: 0, w: 6, h: 4 }),
      }),
      makeWidget({
        id: "w2",
        layout: makeLayout({ i: "w2", x: 6, y: 0, w: 6, h: 4 }),
      }),
    ];
    const pos = getNextPosition(children, 6);
    // lastRowY = maxBottom - 1 = 4 - 1 = 3
    expect(pos).toEqual({ x: 12, y: 3 });
  });

  it("wraps to new row when width doesn't fit", () => {
    const children = [
      makeWidget({
        layout: makeLayout({ x: 0, y: 0, w: 20, h: 3 }),
      }),
    ];
    // Width 6 doesn't fit: 20 + 6 > 24
    const pos = getNextPosition(children, 6);
    expect(pos).toEqual({ x: 0, y: 3 });
  });

  it("defaults width to 1 when not specified", () => {
    const children = [
      makeWidget({
        layout: makeLayout({ x: 0, y: 0, w: GRID_COLS - 1, h: 2 }),
      }),
    ];
    // Default width=1, fits: 23 + 1 <= 24
    // lastRowY = maxBottom - 1 = 2 - 1 = 1
    const pos = getNextPosition(children);
    expect(pos).toEqual({ x: GRID_COLS - 1, y: 1 });
  });

  it("handles widgets with different heights", () => {
    const children = [
      makeWidget({
        id: "w1",
        layout: makeLayout({ i: "w1", x: 0, y: 0, w: 12, h: 2 }),
      }),
      makeWidget({
        id: "w2",
        layout: makeLayout({ i: "w2", x: 12, y: 0, w: 12, h: 5 }),
      }),
    ];
    // maxBottom = 5 (from w2), lastRowY = 4, w2 spans rows 0-4
    // usedColumns in last row = max(12+12) = 24 -> full
    const pos = getNextPosition(children, 6);
    expect(pos).toEqual({ x: 0, y: 5 });
  });
});
