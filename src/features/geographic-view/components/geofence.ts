import { CompositeLayer, GeoJsonLayer, Layer } from "deck.gl";

export class GeofenceLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    return [
      new GeoJsonLayer({
        id: "geofence-layer",
        data: this.props.data,
        getFillColor: [160, 160, 180, 200],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
      }),
    ];
  }
}
