import { describe, expect, it } from "vitest";
import { SINGLE_POINT_ZOOM, showsNoData, tripCamera } from "./trip-camera";

const casePoint = { longitude: -70.6693, latitude: -33.4489 };
const a = { longitude: -70.6, latitude: -33.4 };
const b = { longitude: -70.7, latitude: -33.5 };

describe("tripCamera", () => {
  it("opens on the case point without positions", () => {
    expect(tripCamera([], casePoint)).toEqual({
      kind: "point",
      target: [-70.6693, -33.4489],
      zoom: SINGLE_POINT_ZOOM,
    });
    expect(tripCamera(null, null)).toBeNull();
  });

  it("flies to a single position instead of fitting empty bounds", () => {
    expect(tripCamera([a], casePoint)).toEqual({
      kind: "point",
      target: [-70.6, -33.4],
      zoom: SINGLE_POINT_ZOOM,
    });
  });

  it("fits two or more positions", () => {
    expect(tripCamera([a, b], casePoint)).toEqual({ kind: "bounds" });
    expect(tripCamera([a, b, a], null)).toEqual({ kind: "bounds" });
  });

  it("ignores a position without coordinates", () => {
    expect(
      tripCamera([{ longitude: Number.NaN, latitude: Number.NaN }], null)
    ).toBeNull();
  });
});

describe("showsNoData", () => {
  it("is shown only without positions and without a case point", () => {
    expect(showsNoData(false, [], null)).toBe(true);
    expect(showsNoData(false, [], casePoint)).toBe(false);
    expect(showsNoData(false, [a], null)).toBe(false);
    expect(showsNoData(false, [a, b], null)).toBe(false);
    expect(showsNoData(true, [], null)).toBe(false);
  });
});
