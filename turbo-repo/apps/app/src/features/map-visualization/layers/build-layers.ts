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
import type { MapLayerData } from "../use-map-data-provider";
import { DataProviderPointLayer } from "./point-layer";
import { DataProviderPathLayer } from "./path-layer";
import { DataProviderPolygonLayer } from "./polygon-layer";
import { LocationPinLayer } from "./location-pin-layer";
import { PolygonCenterPinLayer } from "./polygon-center-pin-layer";
import { PinLayer } from "@/features/geographic-view/components/layers/pin_layer_clustered";

function isPointFeature(f: Feature): f is Feature<Point, MapFeatureProperties> {
  return f.geometry?.type === "Point";
}

function isLineFeature(
  f: Feature
): f is Feature<LineString | MultiLineString, MapFeatureProperties> {
  return (
    f.geometry?.type === "LineString" || f.geometry?.type === "MultiLineString"
  );
}

function isPolygonFeature(
  f: Feature
): f is Feature<Polygon | MultiPolygon, MapFeatureProperties> {
  return (
    f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
  );
}

/**
 * Splits a GeoJSON FeatureCollection by geometry type and builds
 * one deck.gl layer per geometry type present.
 */
export function buildDataProviderLayers(
  data: FeatureCollection,
  defaults?: MapDataProviderDefaults,
  selectedPath?: { layerId: string; featureIndex: number } | null
): LayersList {
  if (!data?.features) return [];
  const points = data.features.filter(isPointFeature) as Feature<
    Point,
    MapFeatureProperties
  >[];
  const lines = data.features.filter(isLineFeature) as Feature<
    LineString | MultiLineString,
    MapFeatureProperties
  >[];
  const polygons = data.features.filter(isPolygonFeature) as Feature<
    Polygon | MultiPolygon,
    MapFeatureProperties
  >[];

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
        pickable: true,
        selectedFeatureIndex:
          selectedPath?.layerId === "data-provider-lines"
            ? selectedPath.featureIndex
            : -1,
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

// ============================================================================
// GeoJSON → PinLayer data conversion
// ============================================================================

interface PinDataItem {
  longitude: number;
  latitude: number;
  speed_limit_condition: number;
  symptoms_condition: number;
  heading: number;
  lost_signal: boolean;
  [key: string]: unknown;
}

function geoJsonPointsToPinData(
  features: Feature<Point, MapFeatureProperties>[]
): PinDataItem[] {
  return features.map((f) => ({
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    speed_limit_condition:
      ((f.properties as Record<string, unknown>)
        ?.speed_limit_condition as number) ?? 0,
    symptoms_condition:
      ((f.properties as Record<string, unknown>)
        ?.symptoms_condition as number) ?? 0,
    heading:
      ((f.properties as Record<string, unknown>)?.heading as number) ?? 0,
    lost_signal:
      ((f.properties as Record<string, unknown>)?.lost_signal as boolean) ??
      false,
    ...f.properties,
  }));
}

// ============================================================================
// Named layer builder — one deck.gl layer per MapLayer entry
// ============================================================================

function buildPointLayer(
  layer: MapLayerData["layer"],
  points: Feature<Point, MapFeatureProperties>[],
  defaults: MapDataProviderDefaults,
  zoom: number
): LayersList {
  if (layer.style?.pointMode === "pin") {
    return [
      new PinLayer({
        id: `named-layer-${layer.id}-pins`,
        data: geoJsonPointsToPinData(points),
        zoom,
        updateTriggers: { data: points },
        pickable: true,
      }),
    ];
  }
  if (layer.style?.pointMode === "location-pin") {
    return [
      new LocationPinLayer({
        id: `named-layer-${layer.id}-location-pins`,
        data: points,
        defaults,
        pickable: true,
        updateTriggers: { data: points },
      }),
    ];
  }
  return [
    new DataProviderPointLayer({
      id: `named-layer-${layer.id}-points`,
      data: points,
      defaults,
      updateTriggers: { data: points },
    }),
  ];
}

function buildLineLayer(
  layer: MapLayerData["layer"],
  lines: Feature<LineString | MultiLineString, MapFeatureProperties>[],
  defaults: MapDataProviderDefaults,
  selectedPath?: { layerId: string; featureIndex: number } | null
): LayersList {
  const pathLayerId = `named-layer-${layer.id}-lines`;
  return [
    new DataProviderPathLayer({
      id: pathLayerId,
      data: lines,
      defaults,
      pickable: true,
      selectedFeatureIndex:
        selectedPath?.layerId === pathLayerId
          ? selectedPath.featureIndex
          : -1,
      updateTriggers: { data: lines },
    }),
  ];
}

function buildPolygonLayers(
  layer: MapLayerData["layer"],
  polygons: Feature<Polygon | MultiPolygon, MapFeatureProperties>[],
  defaults: MapDataProviderDefaults
): LayersList {
  return [
    new DataProviderPolygonLayer({
      id: `named-layer-${layer.id}-polygons`,
      data: polygons,
      defaults,
      pickable: true,
      updateTriggers: { data: polygons },
    }),
    new PolygonCenterPinLayer({
      id: `named-layer-${layer.id}-polygon-center-pins`,
      data: polygons,
      defaults,
      pickable: true,
      updateTriggers: { data: polygons },
    }),
  ];
}

/**
 * Builds deck.gl layers for a list of named MapLayer entries.
 * Each layer uses its own style and only renders features that match
 * its declared geometryType.
 */
export function buildNamedMapLayers(
  entries: MapLayerData[],
  zoom = 2,
  selectedPath?: { layerId: string; featureIndex: number } | null
): LayersList {
  const result: LayersList = [];

  for (const { layer, data } of entries) {
    if (!data?.features) continue;

    const s = layer.style ?? {};
    const defaults: MapDataProviderDefaults = {
      pointColor: s.color,
      pointRadius: s.radius,
      lineColor: s.color,
      lineWidth: s.lineWidth,
      polygonFillColor: s.color,
      polygonStrokeColor: s.strokeColor,
      polygonFillOpacity: s.opacity,
    };

    const layerGroup = buildLayerGroup(
      layer,
      data,
      defaults,
      zoom,
      selectedPath
    );
    result.push(...layerGroup);
  }

  return result;
}

function buildLayerGroup(
  layer: MapLayerData["layer"],
  data: FeatureCollection,
  defaults: MapDataProviderDefaults,
  zoom: number,
  selectedPath?: { layerId: string; featureIndex: number } | null
): LayersList {
  if (!data?.features) return [];
  if (layer.geometryType === "Point") {
    const points = data.features.filter(isPointFeature) as Feature<
      Point,
      MapFeatureProperties
    >[];
    return points.length > 0 ? buildPointLayer(layer, points, defaults, zoom) : [];
  }
  if (layer.geometryType === "LineString") {
    const lines = data.features.filter(isLineFeature) as Feature<
      LineString | MultiLineString,
      MapFeatureProperties
    >[];
    return lines.length > 0 ? buildLineLayer(layer, lines, defaults, selectedPath) : [];
  }
  if (layer.geometryType === "Polygon") {
    const polygons = data.features.filter(isPolygonFeature) as Feature<
      Polygon | MultiPolygon,
      MapFeatureProperties
    >[];
    return polygons.length > 0 ? buildPolygonLayers(layer, polygons, defaults) : [];
  }
  return [];
}
