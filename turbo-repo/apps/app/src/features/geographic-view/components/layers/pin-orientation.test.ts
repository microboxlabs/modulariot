import { describe, expect, it } from "vitest";
import {
  headingOffsetMeters,
  headingToYaw,
  shouldShowTruckModel,
  truckOrientation,
} from "./pin-orientation";

describe("pin orientation", () => {
  it("keeps the previous 2D pin yaw", () => {
    expect(headingToYaw(0)).toBe(360);
    expect(headingToYaw(90)).toBe(450);
    expect(truckOrientation(90)).toEqual([0, 450, 90]);
  });

  it("offsets north when heading is 0", () => {
    const [east, north, up] = headingOffsetMeters(0, 4, 1.6);
    expect(east).toBeCloseTo(0);
    expect(north).toBeCloseTo(4);
    expect(up).toBeCloseTo(1.6);
  });

  it("offsets east when heading is 90", () => {
    const [east, north] = headingOffsetMeters(90, 4, 0);
    expect(east).toBeCloseTo(4);
    expect(north).toBeCloseTo(0);
  });

  it("shows the 2D pin when zoomed out and the 3D truck when close", () => {
    expect(shouldShowTruckModel(4)).toBe(false);
    expect(shouldShowTruckModel(9.9)).toBe(false);
    expect(shouldShowTruckModel(10)).toBe(true);
    expect(shouldShowTruckModel(16)).toBe(true);
  });
});
