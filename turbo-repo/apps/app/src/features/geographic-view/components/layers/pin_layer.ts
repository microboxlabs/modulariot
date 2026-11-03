import { CompositeLayer, IconLayer, Layer, TextLayer } from "deck.gl";
import { createSVGIcon } from "../prototype/svg-generation";
import { OFFLINE_LABEL_BACKGROUND } from "../../utils/signal-state";

type PinPosition = {
  assetid: string;
  heading: number;
  latitude: number;
  location: string;
  longitude: number;
  speed: number;
  timestamp: string;
};

const WHITE: [number, number, number, number] = [255, 255, 255, 255];

/**
 * The vehicle's current position. `offline` draws it gray and `label`, when
 * set, is written beside it ("Sin señal · hace 12 min").
 */
export class PinLayer extends CompositeLayer<any> {
  static readonly layerName = "PinLayer";

  renderLayers(): Layer[] {
    const getIconSize = (count: number) => {
      const baseSize = Math.min(70, count) / 70 + 1;
      return count > 1 ? baseSize * 70 : 50;
    };
    const data = (this.props.data || []).filter(
      (d: PinPosition | undefined) => !!d
    );
    const offline = this.props.offline === true;
    const label: string | null = this.props.label ?? null;

    const layers: Layer[] = [
      new IconLayer({
        id: "IconLayer-base",
        data,
        getIcon: (_d: PinPosition) => ({
          url: createSVGIcon(1, offline),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d: PinPosition) => [d.longitude, d.latitude],
        getAngle: (d: PinPosition) => Math.round(360 + d.heading),
        getSize: (_d: PinPosition) => getIconSize(1),
        updateTriggers: {
          ...this.props.updateTriggers,
          getIcon: [offline],
        },
        pickable: true,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
    if (offline && label) {
      layers.push(
        new TextLayer({
          id: "offline-label",
          data,
          getPosition: (d: PinPosition) => [d.longitude, d.latitude],
          getText: () => label,
          getSize: 12,
          getColor: WHITE,
          getTextAnchor: "start",
          getAlignmentBaseline: "center",
          getPixelOffset: [22, 0],
          background: true,
          getBackgroundColor: OFFLINE_LABEL_BACKGROUND,
          backgroundPadding: [6, 3],
          getBorderColor: WHITE,
          getBorderWidth: 1,
          characterSet: "auto",
          fontFamily: "Inter, system-ui, sans-serif",
          fontWeight: 500,
          updateTriggers: { getText: [label] },
          parameters: { depthTest: false },
        }) as Layer
      );
    }
    return layers;
  }
}
