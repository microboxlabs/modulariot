import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

/*
  1 observation
  2 compromised
  3 critical
  4 code black
*/

function getColor(icu_code: number): [number, number, number, number] {
  switch (icu_code) {
    case 0:
      return [28, 100, 242, 255];
    case 1:
      return [254, 205, 211, 255];
    case 2:
      return [251, 113, 133, 255];
    case 3:
      return [244, 63, 94, 255];
    case 4:
      return [0, 0, 0, 255];
    default:
      return [255, 255, 255, 255];
  }
}

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const zoomLevel = this.props.zoom;
    const selectedPulse = this.props.selectedPulse;

    return [
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-outer",
        data: this.props.data.features,
        getFillColor: () => [
          255,
          255,
          255,
          selectedPulse.length === 0 ? 255 : 0,
        ],
        getRadius: 280000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse],
        },
        pickable: true,
      }) as Layer,
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-inner",
        data: this.props.data.features,
        getFillColor: (d: any) => getColor(d.properties.icu_code),
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedPulse],
        },
      }) as Layer,
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-inner",
        data: this.props.data.features,
        getFillColor: () => [255, 255, 255, 255],
        getRadius: 280000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => {
          if (selectedPulse.includes(d.properties.id)) {
            return d.geometry.coordinates;
          } else {
            return null;
          }
        },
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse],
        },
      }) as Layer,
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-inner",
        data: this.props.data.features,
        getFillColor: (d: any) => getColor(d.properties.icu_code),
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => {
          if (selectedPulse.includes(d.properties.id)) {
            return d.geometry.coordinates;
          } else {
            return null;
          }
        },
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse],
        },
      }) as Layer,
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-inner",
        data: this.props.data.features,
        getFillColor: () => [244, 63, 94, 255],
        getRadius: 140000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => {
          if (d.properties.speed <= 0) {
            return d.geometry.coordinates;
          } else {
            return null;
          }
        },
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse],
        },
      }) as Layer,
    ];
  }
}
