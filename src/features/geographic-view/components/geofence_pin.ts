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
  coordinates: [number, number];
  location_type: number;
  /*
    location_type:
      1: Start
      2: End
      3: Intermediate Stop
  */
};

export class GeofencePinLayer extends CompositeLayer<any> {
  calculateAveragePosition(coordinates: number[][]): [number, number] {
    let sumLng = 0;
    let sumLat = 0;
    let count = 0;

    // Sum up all coordinates
    for (const coord of coordinates) {
      sumLng += coord[0];
      sumLat += coord[1];
      count++;
    }

    // Calculate average
    return [sumLng / count, sumLat / count];
  }

  renderLayers(): Layer[] {
    let processedData: GeofencePinData[] = [];

    for (const feature of this.props.data.features) {
      const coordinates = feature.geometry.coordinates[0];
      const avgPosition = this.calculateAveragePosition(coordinates);
      processedData.push({
        coordinates: avgPosition,
        location_type: feature.properties.location_type,
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
