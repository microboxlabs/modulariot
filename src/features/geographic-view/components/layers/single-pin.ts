import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import pin_atlas from "@assets/icons/map/pin-atlas.png";

const icon_definition = {
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
  geometry: {
    coordinates: number[];
  };
  properties: {
    asset_id: string;
    icu_code: number;
    id: number;
    location_type: number | null;
    rotation: number;
    speed: number;
    timestamp: string;
  };
};

export class GeofencePinLayer extends CompositeLayer<any> {
  static componentName = "GeofencePinLayer";

  renderLayers(): Layer[] {
    // Check if data exists and is an array before filtering
    // Filter out elements with null location_type
    const filteredData = this.props.data.features.filter(
      (d: GeofencePinData) => {
        return d.properties.location_type != null;
      }
    );

    return [
      new IconLayer({
        id: "IconLayer-pin-flag",
        data: filteredData,
        getIcon: (d: GeofencePinData) =>
          d.properties.location_type === 1
            ? "start_pin"
            : d.properties.location_type === 2
              ? "finish_pin"
              : "base_pin",
        getPosition: (d: GeofencePinData) => {
          const coords = d.geometry.coordinates;
          return [coords[0], coords[1], coords.length > 2 ? coords[2] : 0];
        },
        iconAtlas: pin_atlas.src,
        iconMapping: icon_definition,
        getSize: () => 35 / Math.pow(1.0, this.props.zoom),
        sizeScale: 1,
        parameters: {
          depthTest: false,
        },
        pickable: true,
      }),
    ];
  }
}
