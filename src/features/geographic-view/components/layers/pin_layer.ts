import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import Supercluster from "supercluster";
import { PinCountLayer } from "./pin_count";
import { createSVGIcon } from "../prototype/svg-generation";
import conditions_atlas from "@assets/icons/map/conditions-atlas.png";

const icon_definition = {
  remission: {
    x: 0,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  observation: {
    x: 500,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  compromissed: {
    x: 1000,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  stable: {
    x: 1500,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  treatment: {
    x: 2000,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  critical_condition: {
    x: 2500,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
  code_black: {
    x: 3000,
    y: 0,
    width: 25 * 20,
    height: 25 * 20,
    anchorX: (25 * 20) / 2,
    anchorY: (50 * 20) / 2,
    mask: false,
  },
};

type PinPosition = {
  assetid: string
  heading: number
  latitude: number
  location: string
  longitude: number
  speed: number
  timestamp: string
}

export class PinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const getIconSize = (count: number) => {
      const baseSize = Math.min(70, count) / 70 + 1;
      return count > 1 ? baseSize * 70 : 50;
    };

    return [
      new IconLayer({
        id: "IconLayer-base",
        data: (this.props.data || []).filter((d: PinPosition | undefined) => !!d),
        getIcon: (d: PinPosition) => ({
          url: createSVGIcon(
            1,
            false,
          ),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d: PinPosition) => [d.longitude, d.latitude],
        getAngle: (d: PinPosition) =>
          Math.round(360 + d.heading),
        getSize: (d: PinPosition) =>
          getIconSize(1),
        updateTriggers: this.props.updateTriggers,
        pickable: true,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
  }
}
