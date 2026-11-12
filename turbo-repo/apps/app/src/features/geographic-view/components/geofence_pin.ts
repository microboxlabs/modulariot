import { CompositeLayer, IconLayer } from "deck.gl";
import type { LayersList } from "@deck.gl/core";
import { capasBadgesNombres, type ItemNombre } from "@/features/places";
import pin_atlas from "@assets/icons/map/pin-atlas.png";
import { geofencePinPosition } from "../utils/geofence-geometry";

export const icon_definition = {
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

type GeofencePinData = {
  /** The geofence's id; origin and destination can be the same one. */
  id: string;
  coordinates: [number, number];
  location_type: number;
  /** The geofence's name in the GPS database; "" when it has none. */
  name: string;
  /*
    location_type:
      1: Start
      2: End
      3: Intermediate Stop
  */
};

const isOriginOrDestination = (locationType: number) =>
  locationType === 1 || locationType === 2;

/**
 * The origin's and the destination's names as badges like the ones Lugares
 * draws (only the name, no icon), under their flags; one per geofence when
 * both are the same one.
 */
export function nameBadges(pins: GeofencePinData[]): ItemNombre[] {
  const badges = new Map<string, ItemNombre>();
  for (const pin of pins) {
    if (!pin.name || !isOriginOrDestination(pin.location_type)) continue;
    const key = pin.id || `${pin.coordinates.join(",")}|${pin.name}`;
    if (badges.has(key)) continue;
    const [lon, lat] = pin.coordinates;
    badges.set(key, {
      id: `trip-geofence-${key}`,
      name: pin.name,
      color: "",
      icon: "",
      sinIcono: true,
      ancla: [lat, lon],
      abajo: true,
    });
  }
  return [...badges.values()];
}

export class GeofencePinLayer extends CompositeLayer<any> {
  static readonly layerName = "GeofencePinLayer";

  renderLayers(): LayersList {
    const processedData: GeofencePinData[] = [];

    for (const feature of this.props.data.features) {
      const position = geofencePinPosition(feature.geometry);
      if (!position) continue;
      processedData.push({
        id: String(feature.properties.id ?? ""),
        coordinates: position,
        location_type: feature.properties.location_type,
        name: String(feature.properties.name ?? "").trim(),
      });
    }

    return [
      new IconLayer({
        id: "IconLayer-pin-flag",
        data: processedData,
        getIcon: (d: GeofencePinData) =>
          d.location_type === 1
            ? "start_pin"
            : d.location_type === 2
              ? "finish_pin"
              : "base_pin",
        getPosition: (d: GeofencePinData) => d.coordinates,
        iconAtlas: pin_atlas.src,
        iconMapping: icon_definition,
        getSize: () => 35,
        sizeScale: 1,
        parameters: {
          depthTest: false,
        },
        pickable: true,
      }),
      ...capasBadgesNombres(nameBadges(processedData), {
        layerId: "geofence-pin-names",
        mapStyle: this.props.mapStyle,
      }),
    ];
  }
}
