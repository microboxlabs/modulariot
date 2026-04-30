import { CompositeLayer, GeoJsonLayer, Layer } from "deck.gl";
import type {
  Feature,
  Polygon,
  MultiPolygon,
  FeatureCollection,
} from "geojson";
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

type PolygonFeature = Feature<Polygon | MultiPolygon, MapFeatureProperties>;

interface DataProviderPolygonLayerProps {
  data: PolygonFeature[];
  defaults?: MapDataProviderDefaults;
  pickable?: boolean;
  updateTriggers?: Record<string, unknown>;
}

export class DataProviderPolygonLayer extends CompositeLayer<DataProviderPolygonLayerProps> {
  static readonly layerName = "DataProviderPolygonLayer";

  renderLayers(): Layer[] {
    const defaults = this.props.defaults ?? {};
    const fallbackFill =
      defaults.polygonFillColor ?? DEFAULT_PROVIDER_STYLES.polygonFillColor;
    const fallbackStroke =
      defaults.polygonStrokeColor ?? DEFAULT_PROVIDER_STYLES.polygonStrokeColor;
    const fallbackOpacity =
      defaults.polygonFillOpacity ?? DEFAULT_PROVIDER_STYLES.polygonFillOpacity;

    const collection: FeatureCollection = {
      type: "FeatureCollection",
      features: this.props.data ?? [],
    };

    return [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- deck.gl GeoJsonLayer accessor generics are overly strict
      new GeoJsonLayer<any>({
        id: `${this.props.id}-geojson`,
        data: collection,
        // Keep original features intact so properties survive picking
        loaders: [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessor typing
        getFillColor: (d: any) => {
          const feat = d as PolygonFeature;
          const color = feat.properties?.color ?? fallbackFill;
          const opacity = feat.properties?.fillOpacity ?? fallbackOpacity;
          return hexToRgba(color, Math.round(opacity * 255));
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessor typing
        getLineColor: (d: any) => {
          const feat = d as PolygonFeature;
          const stroke = feat.properties?.strokeColor ?? fallbackStroke;
          return hexToRgba(stroke);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessor typing
        getLineWidth: (d: any) =>
          (d as PolygonFeature).properties?.strokeWidth ??
          defaults.lineWidth ??
          DEFAULT_PROVIDER_STYLES.lineWidth,
        pickable: this.props.pickable ?? true,
        updateTriggers: this.props.updateTriggers,
      }) as Layer,
    ];
  }
}
