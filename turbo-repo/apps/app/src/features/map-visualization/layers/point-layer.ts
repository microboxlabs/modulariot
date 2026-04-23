import { CompositeLayer, ScatterplotLayer, Layer } from "deck.gl";
import type { Feature, Point } from "geojson";
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

interface DataProviderPointLayerProps {
  data: Feature<Point, MapFeatureProperties>[];
  defaults?: MapDataProviderDefaults;
  pickable?: boolean;
  updateTriggers?: Record<string, unknown>;
}

export class DataProviderPointLayer extends CompositeLayer<DataProviderPointLayerProps> {
  static layerName = "DataProviderPointLayer";

  renderLayers(): Layer[] {
    const defaults = this.props.defaults ?? {};
    const fallbackColor = hexToRgba(
      defaults.pointColor ?? DEFAULT_PROVIDER_STYLES.pointColor
    );
    const fallbackRadius =
      defaults.pointRadius ?? DEFAULT_PROVIDER_STYLES.pointRadius;

    return [
      new ScatterplotLayer({
        id: `${this.props.id}-scatterplot`,
        data: this.props.data ?? [],
        getPosition: (d: Feature<Point, MapFeatureProperties>) =>
          d.geometry.coordinates as [number, number],
        getFillColor: (d: Feature<Point, MapFeatureProperties>) => {
          if (d.properties?.color) {
            return hexToRgba(d.properties.color);
          }
          return fallbackColor;
        },
        getRadius: (d: Feature<Point, MapFeatureProperties>) =>
          d.properties?.radius ?? fallbackRadius,
        radiusUnits: "pixels",
        pickable: this.props.pickable ?? true,
        updateTriggers: this.props.updateTriggers,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
  }
}
