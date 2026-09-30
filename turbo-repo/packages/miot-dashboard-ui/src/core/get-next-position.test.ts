import { describe, expect, it } from "vitest";
import { getNextPosition } from "./get-next-position";

const layout = (x: number, y: number, w: number, h: number) => ({
  layout: { i: "widget", x, y, w, h },
});

describe("getNextPosition", () => {
  it("starts an empty grid at the origin", () => {
    expect(getNextPosition([])).toEqual({ x: 0, y: 0 });
  });

  it("fits a widget beside the occupied portion of the last row", () => {
    expect(getNextPosition([layout(0, 0, 12, 2)], 12)).toEqual({ x: 12, y: 1 });
  });

  it("starts below a full row when the requested width does not fit", () => {
    expect(getNextPosition([layout(0, 0, 12, 2)], 13)).toEqual({ x: 0, y: 2 });
  });

  it("uses the deepest occupied row, excluding earlier rows", () => {
    const siblings = [
      layout(0, 0, 24, 1),
      layout(0, 1, 6, 3),
      layout(6, 1, 8, 1),
    ];
    expect(getNextPosition(siblings)).toEqual({ x: 6, y: 3 });
    expect(siblings[0]?.layout).toEqual({
      i: "widget",
      x: 0,
      y: 0,
      w: 24,
      h: 1,
    });
  });
});
