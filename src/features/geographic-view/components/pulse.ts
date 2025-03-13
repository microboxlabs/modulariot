import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const zoomLevel = this.props.zoom;

    // Calculate opacity based on zoom level
    const minZoom = 13;
    const maxZoom = 14;
    const opacity = Math.min(
      255,
      Math.max(
        0,
        Math.floor(((zoomLevel - minZoom) / (maxZoom - minZoom)) * 255),
      ),
    );

    return [
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-base",
        data: this.props.data.features,
        stroked: zoomLevel > 13,
        getFillColor: (d: any) => d.properties.color,
        getLineColor: [255, 255, 255, zoomLevel < 13 ? 0 : opacity],
        getLineWidth: 200000 / Math.pow(2, zoomLevel),
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
      }) as Layer,
    ];
  }
}
