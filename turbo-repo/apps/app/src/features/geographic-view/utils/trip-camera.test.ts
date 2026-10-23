import { describe, expect, it } from "vitest";
import {
  CASE_MAX_ZOOM,
  SINGLE_POINT_ZOOM,
  TRIP_MAX_ZOOM,
  showsNoData,
  tripCamera,
} from "./trip-camera";

const casePoint = { longitude: -70.6693, latitude: -33.4489 };
const a = { longitude: -70.6, latitude: -33.4 };
const b = { longitude: -70.7, latitude: -33.5 };

// A track of about 2.5 km inside the city.
const shortTrack = [
  { longitude: -70.651, latitude: -33.443 },
  { longitude: -70.66, latitude: -33.445 },
  { longitude: -70.6745, latitude: -33.4489 },
];

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

  it("fits a trip's positions at region level", () => {
    expect(tripCamera([a, b], null)).toEqual({
      kind: "bounds",
      bounds: [
        [-70.7, -33.5],
        [-70.6, -33.4],
      ],
      maxZoom: TRIP_MAX_ZOOM,
      pitch: 45,
      bearing: 45,
    });
  });

  it("fits a case's short track and its point at street level", () => {
    const point = { longitude: -70.68, latitude: -33.45 };
    expect(tripCamera(shortTrack, point)).toEqual({
      kind: "bounds",
      bounds: [
        [-70.68, -33.45],
        [-70.651, -33.443],
      ],
      maxZoom: CASE_MAX_ZOOM,
      pitch: 0,
      bearing: 0,
    });
  });

  it("ignores positions without coordinates", () => {
    expect(
      tripCamera([{ longitude: Number.NaN, latitude: Number.NaN }], null)
    ).toBeNull();
    expect(
      tripCamera([a, { longitude: Number.NaN, latitude: 1 }], null)
    ).toEqual({
      kind: "point",
      target: [-70.6, -33.4],
      zoom: SINGLE_POINT_ZOOM,
    });
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
