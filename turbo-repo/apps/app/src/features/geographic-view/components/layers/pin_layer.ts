import { CompositeLayer, IconLayer, Layer, TextLayer } from "deck.gl";
import { createSVGIcon } from "../prototype/svg-generation";
import { OFFLINE_LABEL_BACKGROUND } from "../../utils/signal-state";
import { headingToIconAngle, viewportKey } from "../../utils/icon-heading";

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
 * The vehicle's current position. `offline` draws it gray with the
 * disconnected face; `engineOff` draws it gray with its normal face. Offline
 * wins. `label`, when set, is written beside a gray pin ("Sin señal · hace
 * 12 min", "Motor apagado").
 */
export class PinLayer extends CompositeLayer<any> {
  static readonly layerName = "PinLayer";

  shouldUpdateState({ changeFlags }: any) {
    // The pin's angle depends on the map's bearing and pitch.
    return changeFlags.somethingChanged;
  }

  renderLayers(): Layer[] {
    const getIconSize = (count: number) => {
      const baseSize = Math.min(70, count) / 70 + 1;
      return count > 1 ? baseSize * 70 : 50;
    };
    const data = (this.props.data || []).filter(
      (d: PinPosition | undefined) => !!d
    );
    const offline = this.props.offline === true;
    const engineOff = !offline && this.props.engineOff === true;
    const label: string | null = this.props.label ?? null;
    const viewport = this.context?.viewport;

    const layers: Layer[] = [
      new IconLayer({
        id: "IconLayer-base",
        data,
        getIcon: (_d: PinPosition) => ({
          url: createSVGIcon(1, offline, engineOff),
          width: 300,
          height: 500,
          anchorX: 150,
          anchorY: 310,
          mask: false,
        }),
        getPosition: (d: PinPosition) => [d.longitude, d.latitude],
        getAngle: (d: PinPosition) =>
          headingToIconAngle(viewport, d.longitude, d.latitude, d.heading || 0),
        getSize: (_d: PinPosition) => getIconSize(1),
        updateTriggers: {
          ...this.props.updateTriggers,
          getIcon: [offline, engineOff],
          getAngle: viewportKey(viewport),
        },
        pickable: true,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
    if ((offline || engineOff) && label) {
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
