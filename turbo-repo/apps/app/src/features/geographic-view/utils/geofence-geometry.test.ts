import { describe, expect, it } from "vitest";
import type { MultiPolygon, Polygon } from "geojson";
import wkx from "wkx";
import { geofenceGeometry, geofencePinPosition } from "./geofence-geometry";

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

const multiPolygon: MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    polygon.coordinates,
    [
      [
        [10, 10],
        [11, 10],
        [11, 11],
        [10, 10],
      ],
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
  it.each([polygon, multiPolygon])(
    "places a pin on $type GeoJSON",
    (geometry) => {
      expect(geofencePinPosition(geofenceGeometry(geometry))).toEqual([
        0.5, 0.25,
      ]);
    }
  );
  it.each([polygon, multiPolygon])("places a pin on $type WKB", (geometry) => {
    const wkb = wkx.Geometry.parseGeoJSON(geometry).toWkb().toString("hex");
    expect(geofenceGeometry(wkb)).toEqual(geometry);
    expect(geofencePinPosition(geofenceGeometry(wkb))).toEqual([0.5, 0.25]);
  });
  it("omits pins for empty or unsupported geometry", () => {
    expect(
      geofencePinPosition({ type: "Polygon", coordinates: [] })
    ).toBeNull();
    expect(
      geofencePinPosition({ type: "Point", coordinates: [0, 0] })
    ).toBeNull();
  });
});
