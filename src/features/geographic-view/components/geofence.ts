import { CompositeLayer, GeoJsonLayer, Layer } from "deck.gl";

export class GeofenceLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    return [
      new GeoJsonLayer({
        id: "geofence-layer",
        data: this.props.data,
        getFillColor: [255, 105, 180, 100],
        getLineColor: [250, 250, 250, 250],
        getLineWidth: 5,
      }),
    ];
  }
}
