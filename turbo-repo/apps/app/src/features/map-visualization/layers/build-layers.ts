import type { LayersList } from "@deck.gl/core";
import type {
  FeatureCollection,
  Feature,
  Point,
  LineString,
  MultiLineString,
  Polygon,
  MultiPolygon,
} from "geojson";
import type {
  MapFeatureProperties,
  MapDataProviderDefaults,
} from "../map-data-provider.types";
import { DataProviderPointLayer } from "./point-layer";
import { DataProviderPathLayer } from "./path-layer";
import { DataProviderPolygonLayer } from "./polygon-layer";

function isPointFeature(f: Feature): f is Feature<Point, MapFeatureProperties> {
  return f.geometry.type === "Point";
}

function isLineFeature(
  f: Feature
): f is Feature<LineString | MultiLineString, MapFeatureProperties> {
  return (
    f.geometry.type === "LineString" || f.geometry.type === "MultiLineString"
  );
}

function isPolygonFeature(
  f: Feature
): f is Feature<Polygon | MultiPolygon, MapFeatureProperties> {
  return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon";
}

/**
 * Splits a GeoJSON FeatureCollection by geometry type and builds
 * one deck.gl layer per geometry type present.
 */
export function buildDataProviderLayers(
  data: FeatureCollection,
  defaults?: MapDataProviderDefaults
): LayersList {
  const points: Feature<Point, MapFeatureProperties>[] = [];
  const lines: Feature<LineString | MultiLineString, MapFeatureProperties>[] =
    [];
  const polygons: Feature<Polygon | MultiPolygon, MapFeatureProperties>[] = [];

  for (const feature of data.features) {
    if (isPointFeature(feature)) {
      points.push(feature);
    } else if (isLineFeature(feature)) {
      lines.push(feature);
    } else if (isPolygonFeature(feature)) {
      polygons.push(feature);
    }
  }

  const layers: LayersList = [];

  if (polygons.length > 0) {
    layers.push(
      new DataProviderPolygonLayer({
        id: "data-provider-polygons",
        data: polygons,
        defaults,
        updateTriggers: { data: polygons },
      })
    );
  }

  if (lines.length > 0) {
    layers.push(
      new DataProviderPathLayer({
        id: "data-provider-lines",
        data: lines,
        defaults,
        updateTriggers: { data: lines },
      })
    );
  }

  if (points.length > 0) {
    layers.push(
      new DataProviderPointLayer({
        id: "data-provider-points",
        data: points,
        defaults,
        updateTriggers: { data: points },
      })
    );
  }

  return layers;
}
