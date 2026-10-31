import { describe, expect, it } from "vitest";
import type { Polygon } from "geojson";
import wkx from "wkx";
import { geofenceGeometry } from "./geofence-geometry";

const polygon: Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};

describe("geofence geometry", () => {
  it("renders the modulith's GeoJSON polygon", () => {
    expect(geofenceGeometry(polygon)).toEqual(polygon);
  });
  it("renders the legacy RPC's WKB polygon", () => {
    const wkb = wkx.Geometry.parseGeoJSON(polygon).toWkb().toString("hex");
    expect(geofenceGeometry(wkb)).toEqual(polygon);
  });
});
