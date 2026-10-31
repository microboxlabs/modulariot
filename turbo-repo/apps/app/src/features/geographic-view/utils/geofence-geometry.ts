import type { Geometry } from "geojson";
import wkx from "wkx";
import { ringCentroid } from "./vehicle-origin";

export function geofenceGeometry(location: string | Geometry): Geometry {
  if (typeof location === "string") {
    return wkx.Geometry.parse(
      Buffer.from(location, "hex")
    ).toGeoJSON() as Geometry;
  }
  return location;
}

export function geofencePinPosition(geometry: Geometry) {
  let ring: number[][] | undefined;
  if (geometry.type === "Polygon") ring = geometry.coordinates[0];
  if (geometry.type === "MultiPolygon") ring = geometry.coordinates[0]?.[0];
  if (!ring?.length) return null;
  const position = ringCentroid(
    ring.map(([longitude, latitude]) => [longitude, latitude])
  );
  return position?.every(Number.isFinite) ? position : null;
}
