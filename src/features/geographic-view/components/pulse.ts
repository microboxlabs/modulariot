import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

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
