import { CompositeLayer, GeoJsonLayer, IconLayer, Layer } from "deck.gl";
import base_pin from "@assets/icons/map/base-pin.svg";
import finish_pin from "@assets/icons/map/finish-pin.png";



export class GeofenceLayer extends CompositeLayer<any> {

  renderLayers(): Layer[] {
    return [
      new GeoJsonLayer({
        id: "geofence-layer",
        data: this.props.data,
        getFillColor: [255, 105, 180, 100],
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 5,
      }),
    ];
  }
}
