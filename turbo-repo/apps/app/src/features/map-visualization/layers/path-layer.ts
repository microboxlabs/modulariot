import { CompositeLayer, ScatterplotLayer, Layer } from "deck.gl";
import type { Feature, LineString, MultiLineString } from "geojson";
import type {
  MapFeatureProperties,
  MapDataProviderDefaults,
} from "../map-data-provider.types";
import { DEFAULT_PROVIDER_STYLES } from "../map-data-provider.types";

function hexToRgba(hex: string, alpha = 255): [number, number, number, number] {
  const clean = hex.replace("#", "");
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return [r, g, b, alpha];
}

type LineFeature = Feature<LineString | MultiLineString, MapFeatureProperties>;

function extractPaths(feature: LineFeature): number[][] {
  if (feature.geometry.type === "LineString") {
    return feature.geometry.coordinates as number[][];
  }
  // MultiLineString: flatten all coordinate arrays into one path
  return feature.geometry.coordinates.flat() as number[][];
}

/**
 * Each coordinate along a path, structured as a GeoJSON Feature-like object
 * so that `properties` survives deck.gl picking for tooltip resolution.
 */
interface PathDotFeature {
  type: "Feature";
  properties: MapFeatureProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
  /** Index of the parent LineFeature in the original data array */
  featureIndex: number;
}

function extractDotFeatures(features: LineFeature[]): PathDotFeature[] {
  const dots: PathDotFeature[] = [];
  for (let fi = 0; fi < features.length; fi++) {
    const feature = features[fi];
    const coords = extractPaths(feature);
    for (const c of coords) {
      dots.push({
        type: "Feature",
        properties: feature.properties ?? {},
        geometry: { type: "Point", coordinates: [c[0], c[1]] },
        featureIndex: fi,
      });
    }
  }
  return dots;
}

interface DataProviderPathLayerProps {
  data: LineFeature[];
  defaults?: MapDataProviderDefaults;
  pickable?: boolean;
  selectedFeatureIndex?: number;
  updateTriggers?: Record<string, unknown>;
}

export class DataProviderPathLayer extends CompositeLayer<DataProviderPathLayerProps> {
  static readonly layerName = "DataProviderPathLayer";

  renderLayers(): Layer[] {
    const defaults = this.props.defaults ?? {};
    const fallbackColor = hexToRgba(
      defaults.lineColor ?? DEFAULT_PROVIDER_STYLES.lineColor
    );

    const data = this.props.data ?? [];
    const dots = extractDotFeatures(data);
    const selectedIdx = this.props.selectedFeatureIndex ?? -1;
    const baseRadius =
      this.props.defaults?.lineWidth ?? DEFAULT_PROVIDER_STYLES.lineWidth;

    // When a path is selected, only its dots get the white halo;
    // otherwise all dots show it.
    const bgDots =
      selectedIdx >= 0
        ? dots.filter((d) => d.featureIndex === selectedIdx)
        : dots;

    return [
      // White background halo
      new ScatterplotLayer<PathDotFeature>({
        id: `${this.props.id}-dots-bg`,
        data: bgDots,
        getPosition: (d) => d.geometry.coordinates,
        getFillColor: [255, 255, 255, 255],
        getRadius: baseRadius + 2,
        radiusUnits: "pixels",
        pickable: false,
        parameters: { depthTest: false },
      }) as Layer,

      // Colored foreground dots (pickable)
      new ScatterplotLayer<PathDotFeature>({
        id: `${this.props.id}-dots`,
        data: dots,
        getPosition: (d) => d.geometry.coordinates,
        getFillColor: (d) => {
          if (d.properties?.color) {
            return hexToRgba(d.properties.color);
          }
          return fallbackColor;
        },
        getRadius: baseRadius,
        radiusUnits: "pixels",
        pickable: this.props.pickable ?? true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
        updateTriggers: this.props.updateTriggers,
        parameters: { depthTest: false },
      }) as Layer,
    ];
  }
}
