import { CompositeLayer, GeoJsonLayer, Layer } from "deck.gl";

export class GeofenceLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    return [
      new GeoJsonLayer({
        id: "geofence-layer",
        data: this.props.data,
        getFillColor: [252, 211, 77, 150],
        getLineColor: [245, 158, 11, 250],
        getLineWidth: 2,
      }),
    ];
  }
}
