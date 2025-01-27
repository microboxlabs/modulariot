import { CompositeLayer, IconLayer, Layer, TextLayer } from "deck.gl";
import { createSVGIcon, svgToDataURL } from "./map-visualization.utils";

export class PinCountLayer extends CompositeLayer {
  renderLayers(): Layer | null {
    const getScaledOffset = (d: unknown) => {
      const count = (d as any).properties.cluster
        ? (d as any).properties.point_count
        : 1;
      const baseOffset = [-35, 25]; // Original offset for unscaled pin
      const scale = Math.min(100, count) / 100 + 1; // Same scaling factor as in PinLayer

      return [baseOffset[0] * scale, baseOffset[1] * scale];
    };

    const getScale = (d: any) => {
      const count = d.properties.cluster ? d.properties.point_count : 1;
      return Math.min(100, count) / 100 + 1; // Same scaling factor as in PinLayer
    };

    return [
      new IconLayer({
        id: "IconLayer-count-bg",
        data: this.props.data,
        getIcon: (d) => ({
          url: svgToDataURL(
            createSVGIcon(
              (d.properties.cluster
                ? d.properties.point_count.toString()
                : "1") as string,
            ),
          ),
          width: 480,
          height: 480,
        }),
        sizeScale: 1,
        getPixelOffset: getScaledOffset,
        getSize: (d) => {
          const baseSize = 50;
          return baseSize * getScale(d);
        },
        getPosition: (d) => d.geometry.coordinates,
        updateTriggers: {
          getSize: this.props.updateTriggers?.getSize,
          getPosition: this.props.updateTriggers,
        },
      }),

      new TextLayer({
        id: "TextLayer-count",
        data: this.props.data,
        getText: (d: any) =>
          d.properties.cluster ? d.properties.point_count.toString() : "1",
        getPosition: (d: any) => d.geometry.coordinates,
        getSize: (d) => {
          const baseSize = 15;
          return baseSize * getScale(d);
        },
        getColor: [0, 0, 0],
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        updateTriggers: {
          getSize: this.props.updateTriggers?.getSize,
          getPosition: this.props.updateTriggers,
        },
        getPixelOffset: (d) => {
          let offset = getScaledOffset(d);
          offset[1] -= 6 * getScale(d);
          return offset;
        },
      }),
    ];
  }
}
