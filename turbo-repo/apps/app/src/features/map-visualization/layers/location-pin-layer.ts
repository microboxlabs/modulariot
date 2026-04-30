import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import type { Feature, Point } from "geojson";
import type {
  MapFeatureProperties,
  MapDataProviderDefaults,
} from "../map-data-provider.types";
import { DEFAULT_PROVIDER_STYLES } from "../map-data-provider.types";

// ============================================================================
// SVG location-pin icon generator
// ============================================================================

const svgCache = new Map<string, string>();

export function createLocationPinSvg(hex: string): string {
  const color = hex.startsWith("#") ? hex : `#${hex}`;
  const cached = svgCache.get(color);
  if (cached) return cached;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48">` +
      `<path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" ` +
      `fill="${color}" stroke="#fff" stroke-width="1"/>` +
      `<circle cx="12" cy="9" r="3" fill="#fff"/>` +
      `</svg>`
  )}`;
  svgCache.set(color, url);
  return url;
}

const iconCache = new Map<string, { url: string; width: number; height: number; anchorX: number; anchorY: number; mask: boolean }>();

function getLocationPinIcon(color: string) {
  const cached = iconCache.get(color);
  if (cached) return cached;
  const icon = {
    url: createLocationPinSvg(color),
    width: 48,
    height: 48,
    anchorX: 24,
    anchorY: 48,
    mask: false,
  };
  iconCache.set(color, icon);
  return icon;
}

// ============================================================================
// Layer
// ============================================================================

interface LocationPinLayerProps {
  data: Feature<Point, MapFeatureProperties>[];
  defaults?: MapDataProviderDefaults;
  pickable?: boolean;
  updateTriggers?: Record<string, unknown>;
}

export class LocationPinLayer extends CompositeLayer<LocationPinLayerProps> {
  static readonly layerName = "LocationPinLayer";

  renderLayers(): Layer[] {
    const defaults = this.props.defaults ?? {};
    const fallbackColor =
      defaults.pointColor ?? DEFAULT_PROVIDER_STYLES.pointColor;

    return [
      new IconLayer({
        id: `${this.props.id}-icons`,
        data: this.props.data ?? [],
        getPosition: (d: Feature<Point, MapFeatureProperties>) =>
          d.geometry.coordinates as [number, number],
        getIcon: (d: Feature<Point, MapFeatureProperties>) => {
          const color = d.properties?.color ?? fallbackColor;
          return getLocationPinIcon(color);
        },
        getSize: (d: Feature<Point, MapFeatureProperties>) =>
          d.properties?.radius ?? 36,
        sizeUnits: "pixels",
        pickable: this.props.pickable !== false,
        updateTriggers: this.props.updateTriggers,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
  }
}
