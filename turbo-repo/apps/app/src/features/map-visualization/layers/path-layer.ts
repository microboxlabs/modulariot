import { CompositeLayer, PathLayer, Layer } from "deck.gl";
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

interface DataProviderPathLayerProps {
  data: LineFeature[];
  defaults?: MapDataProviderDefaults;
  pickable?: boolean;
  updateTriggers?: Record<string, unknown>;
}

export class DataProviderPathLayer extends CompositeLayer<DataProviderPathLayerProps> {
  static layerName = "DataProviderPathLayer";

  renderLayers(): Layer[] {
    const defaults = this.props.defaults ?? {};
    const fallbackColor = hexToRgba(
      defaults.lineColor ?? DEFAULT_PROVIDER_STYLES.lineColor
    );
    const fallbackWidth =
      defaults.lineWidth ?? DEFAULT_PROVIDER_STYLES.lineWidth;

    return [
      new PathLayer<LineFeature>({
        id: `${this.props.id}-path`,
        data: this.props.data ?? [],
        getPath: (d) => extractPaths(d) as unknown as number[],
        getColor: (d) => {
          if (d.properties?.color) {
            return hexToRgba(d.properties.color);
          }
          return fallbackColor;
        },
        getWidth: (d) => d.properties?.strokeWidth ?? fallbackWidth,
        widthUnits: "pixels",
        pickable: this.props.pickable ?? true,
        updateTriggers: this.props.updateTriggers,
      }) as Layer,
    ];
  }
}
