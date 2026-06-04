import { describe, it, expect } from "vitest";
import { fitLayoutToCols } from "./fit-layout-to-cols";

describe("fitLayoutToCols", () => {
  it("caps a widget wider than cols to the available width", () => {
    const out = fitLayoutToCols([{ i: "a", x: 0, y: 0, w: 36, h: 4 }], 24);
    expect(out).toHaveLength(1);
    expect(out[0].w).toBe(24);
    expect(out[0].x).toBe(0);
  });

  it("repositions an in-range-width widget that starts out of bounds", () => {
    const out = fitLayoutToCols([{ i: "a", x: 30, y: 0, w: 6, h: 2 }], 24);
    expect(out[0].w).toBe(6);
    expect(out[0].x).toBe(18); // min(30, 24 - 6)
  });

  it("leaves a layout that already fits unchanged in x/w", () => {
    const out = fitLayoutToCols(
      [
        { i: "a", x: 0, y: 0, w: 8, h: 2 },
        { i: "b", x: 8, y: 0, w: 8, h: 2 },
      ],
      24
    );
    const a = out.find((l) => l.i === "a")!;
    const b = out.find((l) => l.i === "b")!;
    expect(a.x).toBe(0);
    expect(a.w).toBe(8);
    expect(b.x).toBe(8);
    expect(b.w).toBe(8);
    expect(a.y).toBe(0);
    expect(b.y).toBe(0); // no overlap → stays on the same row
  });

  it("stacks widgets that overlap after clamping", () => {
    const out = fitLayoutToCols(
      [
        { i: "a", x: 0, y: 0, w: 24, h: 2 },
        { i: "b", x: 24, y: 0, w: 24, h: 2 },
      ],
      24
    );
    const a = out.find((l) => l.i === "a")!;
    const b = out.find((l) => l.i === "b")!;
    // both clamp to x:0,w:24 and would overlap at y:0 → compaction stacks them
    expect(a.w).toBe(24);
    expect(b.w).toBe(24);
    expect(a.y).not.toBe(b.y);
    expect(Math.max(a.y, b.y)).toBeGreaterThanOrEqual(2);
  });

  it("preserves the item id and height", () => {
    const out = fitLayoutToCols([{ i: "tall", x: 0, y: 0, w: 40, h: 7 }], 24);
    expect(out[0].i).toBe("tall");
    expect(out[0].h).toBe(7);
  });
});
