import type { FeatureCollection } from "geojson";

// ============================================================================
// Per-feature styling properties (embedded in GeoJSON feature.properties)
// ============================================================================

export interface MapFeatureProperties {
  /** Fill / point color as hex (e.g. "FF5500") */
  color?: string;
  /** Stroke / outline color as hex */
  strokeColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Fill opacity 0-1 (polygons) */
  fillOpacity?: number;
  /** Point radius in pixels */
  radius?: number;
  /** Label text rendered near the feature */
  label?: string;
}

// ============================================================================
// Global default styling (fallbacks when feature properties are absent)
// ============================================================================

export interface MapDataProviderDefaults {
  pointColor?: string;
  pointRadius?: number;
  lineColor?: string;
  lineWidth?: number;
  polygonFillColor?: string;
  polygonStrokeColor?: string;
  polygonFillOpacity?: number;
}

export const DEFAULT_PROVIDER_STYLES: Required<MapDataProviderDefaults> = {
  pointColor: "3388FF",
  pointRadius: 8,
  lineColor: "3388FF",
  lineWidth: 3,
  polygonFillColor: "3388FF",
  polygonStrokeColor: "FFFFFF",
  polygonFillOpacity: 0.35,
};

// ============================================================================
// Tooltip configuration (per layer, shown on feature hover)
// ============================================================================

export interface MapLayerTooltip {
  /** Handlebars template string, e.g. "{{row.label}}: {{row.value}}" */
  template: string;
}

// ============================================================================
// Named map layer (one per data origin)
// ============================================================================

export type MapLayerGeometryType = "Point" | "LineString" | "Polygon";

/** How to render point features on the map */
export type PointRenderMode = "circle" | "pin" | "location-pin";

export interface MapLayerStyle {
  /** Fill color for points and polygons, line color for paths (hex without #) */
  color?: string;
  /** Point radius in pixels */
  radius?: number;
  /** Line / polygon stroke width in pixels */
  lineWidth?: number;
  /** Polygon stroke color (hex without #) */
  strokeColor?: string;
  /** Polygon fill opacity 0–1 */
  opacity?: number;
  /** Point rendering mode: "circle" for simple dots, "pin" for vehicle-style pins */
  pointMode?: PointRenderMode;
}

export interface MapLayer {
  id: string;
  name: string;
  geometryType: MapLayerGeometryType;
  provider?: MapDataProvider;
  style?: MapLayerStyle;
  tooltip?: MapLayerTooltip;
}

// ============================================================================
// Data provider discriminated union
// ============================================================================

export interface StaticMapDataProvider {
  type: "static";
  data: FeatureCollection;
}

export interface ApiMapDataProvider {
  type: "api";
  url: string;
  method?: "GET" | "POST";
  refreshInterval?: number;
  /** When true, the response is treated as MapPosition[] with WKB-encoded location fields
   *  and transformed into a GeoJSON FeatureCollection before rendering. */
  transformWkb?: boolean;
  /** Column name containing the WKB geometry. Defaults to "location". */
  geometryField?: string;
  /** Column name for latitude (used when transformWkb is false and latField/lngField are set). */
  latField?: string;
  /** Column name for longitude. */
  lngField?: string;
  /** Dot-notation path to extract the array from the response (e.g. "data", "results.items"). */
  responsePath?: string;
}

export interface SseMapDataProvider {
  type: "sse";
  url: string;
  /** When true, each SSE event payload is treated as a MapPosition record (or array)
   *  with a WKB-encoded location field and transformed into a GeoJSON FeatureCollection. */
  transformWkb?: boolean;
  /** Column name containing the WKB geometry. Defaults to "location". */
  geometryField?: string;
  /** Column name for latitude. */
  latField?: string;
  /** Column name for longitude. */
  lngField?: string;
  /** Dot-notation path to extract the array from the event payload (e.g. "data"). */
  responsePath?: string;
}

export interface PgrestMapDataProvider {
  type: "pgrest";
  functionName: string;
  method: "POST" | "GET";
  params: { key: string; value: string }[];
  dataSourceId?: string;
  refreshInterval?: number;
  /** When true, the response is treated as MapPosition[] with WKB-encoded location fields. */
  transformWkb?: boolean;
  /** Column name containing the WKB geometry. Defaults to "location". */
  geometryField?: string;
  /** Column name for latitude. */
  latField?: string;
  /** Column name for longitude. */
  lngField?: string;
  /** Dot-notation path to extract the array from the response (e.g. "data", "results.items"). */
  responsePath?: string;
}

export interface PlannerMapDataProvider {
  type: "planner";
  variableName: string;
  /** When true, the rows are treated as MapPosition[] with WKB-encoded location fields. */
  transformWkb?: boolean;
  /** Column name containing the WKB geometry. Defaults to "location". */
  geometryField?: string;
  /** Column name for latitude (used when transformWkb is false and latField/lngField are set). */
  latField?: string;
  /** Column name for longitude (used when transformWkb is false and latField/lngField are set). */
  lngField?: string;
  /** Dot-notation path to extract the array from the response (e.g. "data"). */
  responsePath?: string;
}

export type MapDataProvider =
  | StaticMapDataProvider
  | ApiMapDataProvider
  | SseMapDataProvider
  | PgrestMapDataProvider
  | PlannerMapDataProvider;
