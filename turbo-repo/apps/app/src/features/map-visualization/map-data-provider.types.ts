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
}

export interface SseMapDataProvider {
  type: "sse";
  url: string;
}

export type MapDataProvider =
  | StaticMapDataProvider
  | ApiMapDataProvider
  | SseMapDataProvider;
