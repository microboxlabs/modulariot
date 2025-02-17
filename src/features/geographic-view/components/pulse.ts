import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const zoomLevel = this.props.zoom;
    return [
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-base",
        data: this.props.data.features,
        stroked: true,
        getFillColor: (d: any) => d.properties.color,
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 200000 / Math.pow(2, zoomLevel),
        getRadius: 800000 / Math.pow(2, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
      }) as Layer,
    ];
  }
}
