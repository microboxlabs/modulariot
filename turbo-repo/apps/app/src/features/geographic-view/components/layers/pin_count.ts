import { CompositeLayer, Layer, TextLayer } from "deck.gl";
import type { CompositeLayerProps } from "@deck.gl/core";

import { BorderRadiusExtension } from "./border-radius-extension";

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
  updateTriggers?: Record<string, unknown>;
}

interface ClusterData {
  properties: {
    cluster?: boolean;
    point_count?: number;
  };
  geometry: {
    coordinates: [number, number];
  };
}

export class PinCountLayer extends CompositeLayer<PinCountLayerProps> {
  renderLayers(): Layer[] {
    const getScaledOffset = (d: ClusterData): [number, number] => {
      const count = d.properties.cluster ? (d.properties.point_count ?? 1) : 1;
      const baseOffset: [number, number] = [-20, 17];
      const scale = Math.min(100, count) / 100 + 1;

      return [baseOffset[0] * scale, baseOffset[1] * scale];
    };

    const getScale = (d: ClusterData) => {
      const count = d.properties.cluster ? (d.properties.point_count ?? 1) : 1;
      return Math.min(100, count) / 100 + 1;
    };

    return [
      // Text count with rounded background
      new TextLayer({
        id: "TextLayer-count",
        data: this.props.data,
        getText: (d: ClusterData) =>
          d.properties.cluster
            ? (d.properties.point_count ?? 1).toString()
            : "1",
        getPosition: (d: ClusterData) => d.geometry.coordinates,
        getSize: (d: ClusterData) => {
          const baseSize = 12;
          return baseSize * getScale(d);
        },
        getColor: [0, 0, 0, 255] as [number, number, number, number],
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        background: true,
        getBackgroundColor: [253, 224, 71, 255] as [
          number,
          number,
          number,
          number,
        ],
        backgroundPadding: [8, 7, 8, 5] as [number, number, number, number],
        getBorderColor: [255, 255, 255, 255] as [
          number,
          number,
          number,
          number,
        ],
        getBorderWidth: 3,
        extensions: [new BorderRadiusExtension()],
        updateTriggers: {
          getText: this.props.data,
          getSize: this.props.updateTriggers?.getSize,
          getPosition: this.props.updateTriggers,
        },
        getPixelOffset: (d: ClusterData): [number, number] => {
          const offset = getScaledOffset(d);
          offset[1] += getScale(d);
          return offset;
        },
        parameters: {
          depthTest: true,
        },
      }) as Layer,
    ];
  }
}
