import { CompositeLayer, IconLayer, Layer } from "deck.gl";
import { createSVGIcon } from "../prototype/svg-generation";

type PinPosition = {
  assetid: string;
  heading: number;
  latitude: number;
  location: string;
  longitude: number;
  speed: number;
  timestamp: string;
};

export class PinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const getIconSize = (count: number) => {
      const baseSize = Math.min(70, count) / 70 + 1;
      return count > 1 ? baseSize * 70 : 50;
    };

    return [
      new IconLayer({
        id: "IconLayer-base",
        data: (this.props.data || []).filter(
          (d: PinPosition | undefined) => !!d
        ),
        getIcon: (_d: PinPosition) => ({
          url: createSVGIcon(1, false),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d: PinPosition) => [d.longitude, d.latitude],
        getAngle: (d: PinPosition) => Math.round(360 + d.heading),
        getSize: (_d: PinPosition) => getIconSize(1),
        updateTriggers: this.props.updateTriggers,
        pickable: true,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
  }
}
