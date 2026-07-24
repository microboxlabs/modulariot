import { describe, it, expect } from "vitest";
import { computeGridSizing } from "./grid-sizing";

describe("computeGridSizing", () => {
  it("guards a zero/unmeasured container (scale 1, base columns)", () => {
    const s = computeGridSizing({ containerWidth: 0, usedCols: 5, editMode: true }); // editMode irrelevant: zero-width guard returns first
    expect(s.cols).toBe(24);
    expect(s.designWidth).toBeCloseTo(1600, 4);
    expect(s.scale).toBe(1);
    expect(s.offsetLeft).toBe(0);
  });

  it("view mode on a narrow screen scales down within 24 columns", () => {
    const s = computeGridSizing({ containerWidth: 1200, usedCols: 24, editMode: false });
    expect(s.cols).toBe(24);
    expect(s.designWidth).toBeCloseTo(1600, 4);
    expect(s.scale).toBeCloseTo(0.75, 4);
    expect(s.offsetLeft).toBeCloseTo(0, 4);
  });

  it("view mode at ~1080p fills the width (scale slightly > 1, no offset)", () => {
    const s = computeGridSizing({ containerWidth: 1670, usedCols: 24, editMode: false });
    expect(s.cols).toBe(24);
    expect(s.designWidth).toBeCloseTo(1600, 4);
    expect(s.scale).toBeCloseTo(1670 / 1600, 4);
    expect(s.offsetLeft).toBeCloseTo(0, 4);
  });

  it("view mode on 4K clamps the scale and centers", () => {
    const s = computeGridSizing({ containerWidth: 3600, usedCols: 24, editMode: false });
    expect(s.cols).toBe(24);
    expect(s.designWidth).toBeCloseTo(1600, 4);
    expect(s.scale).toBeCloseTo(1.35, 4);
    expect(s.offsetLeft).toBeCloseTo((3600 - 1600 * 1.35) / 2, 4); // 720
  });

  it("edit mode on a wide screen reveals surplus columns at natural scale", () => {
    const s = computeGridSizing({ containerWidth: 2400, usedCols: 24, editMode: true });
    expect(s.cols).toBe(36); // floor(2400 * 24 / 1600)
    expect(s.designWidth).toBeCloseTo(2400, 4);
    expect(s.scale).toBeCloseTo(1, 4);
    expect(s.offsetLeft).toBeCloseTo(0, 4);
  });

  it("edit mode on a narrow screen adds no surplus columns (feature dormant)", () => {
    const s = computeGridSizing({ containerWidth: 1200, usedCols: 24, editMode: true });
    expect(s.cols).toBe(24); // fitCols 18 < 24
    expect(s.scale).toBeCloseTo(0.75, 4);
  });

  it("a widened dashboard keeps its column span in view mode", () => {
    const s = computeGridSizing({ containerWidth: 2400, usedCols: 36, editMode: false });
    expect(s.cols).toBe(36);
    expect(s.designWidth).toBeCloseTo(2400, 4);
    expect(s.scale).toBeCloseTo(1, 4);
  });

  it("view mode clamps a widened board to the screen instead of shrinking it", () => {
    // 36-col content on a ~1366px laptop: fitCols = floor(1366*24/1600) = 20,
    // so view renders at 24 cols (not 36) and scales ~0.85 — NOT ~0.57.
    const s = computeGridSizing({ containerWidth: 1366, usedCols: 36, editMode: false });
    expect(s.cols).toBe(24);
    expect(s.designWidth).toBeCloseTo(1600, 4);
    expect(s.scale).toBeCloseTo(1366 / 1600, 4); // ≈ 0.854, not 1366/2400 ≈ 0.57
  });

  it("view mode renders at the columns that fit when content partially fits", () => {
    // 36-col content on a 1700px screen: fitCols = floor(1700*24/1600) = 25.
    const s = computeGridSizing({ containerWidth: 1700, usedCols: 36, editMode: false });
    expect(s.cols).toBe(25);
    expect(s.designWidth).toBeCloseTo((25 * 1600) / 24, 4);
    expect(s.scale).toBeCloseTo(1700 / ((25 * 1600) / 24), 4); // ≈ 1.02
  });

  it("floors fitCols just under a column multiple (no float round-up)", () => {
    const s = computeGridSizing({ containerWidth: 2399, usedCols: 24, editMode: true });
    expect(s.cols).toBe(35); // floor(2399 * 24 / 1600) = 35, not 36
    expect(s.designWidth).toBeCloseTo((35 * 1600) / 24, 4);
  });

  it("a widened dashboard scales down to fit a smaller container", () => {
    const s = computeGridSizing({ containerWidth: 1600, usedCols: 36, editMode: true });
    expect(s.cols).toBe(36); // max(used 36, fitCols 24)
    expect(s.designWidth).toBeCloseTo(2400, 4);
    expect(s.scale).toBeCloseTo(1600 / 2400, 4); // ≈ 0.667
    expect(s.offsetLeft).toBeCloseTo(0, 4);
  });
});
