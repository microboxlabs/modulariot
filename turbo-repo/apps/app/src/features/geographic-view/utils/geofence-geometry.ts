import type { Geometry } from "geojson";
import wkx from "wkx";

export function geofenceGeometry(location: string | Geometry) {
  if (typeof location === "string") {
    return wkx.Geometry.parse(Buffer.from(location, "hex")).toGeoJSON();
  }
  return location;
}
