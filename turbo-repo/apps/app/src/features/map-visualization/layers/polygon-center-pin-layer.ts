import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type {
  MapFeatureProperties,
  MapDataProviderDefaults,
} from "../map-data-provider.types";
import pin_atlas from "@assets/icons/map/pin-atlas.png";

const iconMapping = {
  base_pin: {
    x: 0,
    y: 0,
    width: 2700,
    height: 2700,
    anchorX: 2700 / 2,
    anchorY: 2700 / 2,
    mask: false,
  },
  finish_pin: {
    x: 2700,
    y: 0,
    width: 2700,
    height: 2700,
    anchorX: 0,
    anchorY: 2700,
    mask: false,
  },
  start_pin: {
    x: 5400,
    y: 0,
    width: 2700,
    height: 2700,
    anchorX: 0,
    anchorY: 2700,
    mask: false,
  },
};

type PinAtlasIcon = keyof typeof iconMapping;

type PolygonFeature = Feature<Polygon | MultiPolygon, MapFeatureProperties>;

/**
 * Data item passed to IconLayer. Structured as a GeoJSON-like Feature
 * with a Point geometry at the polygon centroid, so that the full
 * `properties` and original `geometry` survive deck.gl picking.
 */
interface CentroidFeature {
  type: "Feature";
  properties: MapFeatureProperties;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  /** Original polygon geometry for reference */
  sourceGeometry: PolygonFeature["geometry"];
}

function ringCentroid(ring: number[][]): [number, number] {
  // GeoJSON rings repeat the first coordinate as the last to close the ring.
  // Exclude the closing point so it doesn't skew the average.
  const len = ring.length > 1 ? ring.length - 1 : ring.length;
  let sumLng = 0;
  let sumLat = 0;
  for (let i = 0; i < len; i++) {
    sumLng += ring[i][0];
    sumLat += ring[i][1];
  }
  return [sumLng / len, sumLat / len];
}

function featureCentroid(feature: PolygonFeature): [number, number] {
  if (feature.geometry.type === "Polygon") {
    return ringCentroid(feature.geometry.coordinates[0]);
  }
  // MultiPolygon — use first polygon's outer ring
  return ringCentroid(feature.geometry.coordinates[0][0]);
}

interface PolygonCenterPinLayerProps {
  data: PolygonFeature[];
  defaults?: MapDataProviderDefaults;
  pickable?: boolean;
  updateTriggers?: Record<string, unknown>;
}

export class PolygonCenterPinLayer extends CompositeLayer<PolygonCenterPinLayerProps> {
  static readonly layerName = "PolygonCenterPinLayer";

  renderLayers(): Layer[] {
    const centroidFeatures: CentroidFeature[] = (this.props.data ?? []).map(
      (feature) => ({
        type: "Feature" as const,
        properties: feature.properties ?? {},
        geometry: {
          type: "Point" as const,
          coordinates: featureCentroid(feature),
        },
        sourceGeometry: feature.geometry,
      })
    );

    return [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic constraint too strict for parameters
      new (IconLayer as any)({
        id: `${this.props.id}-icons`,
        data: centroidFeatures,
        getPosition: (d: CentroidFeature) => d.geometry.coordinates,
        getIcon: (d: CentroidFeature): PinAtlasIcon => {
          const icon = (d.properties as Record<string, unknown>)
            ?.icon as PinAtlasIcon | undefined;
          return icon && icon in iconMapping ? icon : "base_pin";
        },
        iconAtlas: pin_atlas.src,
        iconMapping,
        getSize: () => 35,
        sizeScale: 1,
        pickable: this.props.pickable !== false,
        updateTriggers: this.props.updateTriggers,
        parameters: { depthTest: false },
      }) as Layer,
    ];
  }
}
