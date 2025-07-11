import { CompositeLayer, IconLayer, Layer, TextLayer } from "deck.gl";
import type { CompositeLayerProps } from "@deck.gl/core";
import { createSVGIcon, svgToDataURL } from "./map-visualization.utils";

interface PinCountLayerProps extends CompositeLayerProps {
  data: Array<{
    properties: {
      cluster?: boolean;
      point_count?: number;
    };
    geometry: {
      coordinates: [number, number];
    };
  }>;
  updateTriggers?: any;
}

export class PinCountLayer extends CompositeLayer<PinCountLayerProps> {
  renderLayers(): Layer[] {
    const getScaledOffset: (d: any) => [number, number] = (d) => {
      const count = d.properties.cluster ? d.properties.point_count : 1;
      const baseOffset: [number, number] = [-22, 17];
      const scale = Math.min(100, count) / 100 + 1;

      return [baseOffset[0] * scale, baseOffset[1] * scale];
    };

    const getScale = (d: any) => {
      const count = d.properties.cluster ? d.properties.point_count : 1;
      return Math.min(100, count) / 100 + 1;
    };

    return [
      new IconLayer({
        id: "IconLayer-count-bg",
        data: this.props.data,
        getIcon: (d: any) => ({
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
          const baseSize = 35;
          return baseSize * getScale(d);
        },
        getPosition: (d) => d.geometry.coordinates,
        updateTriggers: {
          getSize: this.props.updateTriggers?.getSize,
          getPosition: this.props.updateTriggers,
        },
      }) as Layer,

      new TextLayer({
        id: "TextLayer-count",
        data: this.props.data,
        getText: (d: any) =>
          d.properties.cluster ? d.properties.point_count.toString() : "1",
        getPosition: (d: any) => d.geometry.coordinates,
        getSize: (d) => {
          const baseSize = 10;
          return baseSize * getScale(d);
        },
        getColor: [0, 0, 0] as [number, number, number],
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        updateTriggers: {
          getSize: this.props.updateTriggers?.getSize,
          getPosition: this.props.updateTriggers,
        },
        getPixelOffset: ((d) => {
          let offset = getScaledOffset(d);
          offset[1] -= 6 * getScale(d);
          return offset;
        }) as (d: any) => [number, number],
      }) as Layer,
    ];
  }
}
