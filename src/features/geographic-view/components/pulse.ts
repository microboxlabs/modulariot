import { CompositeLayer, GeoJsonLayer, IconLayer, Layer, PathLayer } from "deck.gl";
import pinbg from "@assets/testing/PinBg.svg";
import face from "@assets/testing/Face.svg";
import Supercluster from "supercluster";
import { PinCountLayer } from "./pin_count";
import square from "@assets/testing/Square.png";
import { ScatterplotLayer } from "deck.gl";
const icon_definition = {
  square: {
    url: "@assets/testing/Square.png",
    x: 0,
    y: 0,
    width: 120,
    height: 120,
    anchorX: 120 / 2,
    anchorY: 120 / 2,
    mask: true,
  },
};

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    return [
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-base",
        data: this.props.data.features,
        stroked: true,
        getFillColor: (d: any) => d.properties.color,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 250,
        getRadius: 1000,
        getPosition: (d: any) => d.geometry.coordinates,
      }) as Layer,

    ];
  }
}
