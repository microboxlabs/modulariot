import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

/*
  1 observation
  2 compromised
  3 critical
  4 code black
*/

const colors = {
  "0": [100, 100, 100], // has no icu eaning is stable
  "1": [254, 205, 211], // observation
  "2": [251, 113, 133], // compromised
  "3": [244, 63, 94], // critical
  "4": [0, 0, 0], // code black
};

function getColor(icu_code: number, opacity: number) {
  switch (icu_code) {
    case 0:
      return [150, 150, 150, opacity];
    case 1:
      return [254, 205, 211, opacity];
    case 2:
      return [251, 113, 133, opacity];
    case 3:
      return [244, 63, 94, opacity];
    case 4:
      return [0, 0, 0, opacity];
  }
}

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const zoomLevel = this.props.zoom;
    const selectedPulse = this.props.selectedPulse;

    console.log("rendered")

    return [
      new ScatterplotLayer({
        id: "ScatterPlotLayer-pulse-outer",
        data: this.props.data.features,
        getFillColor: (d: any) => {
            return [255, 255, 255, selectedPulse ? 0 : 255];
        },
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
        getFillColor: (d: any) => {
          return getColor(d.properties.icu_code, selectedPulse ? 100 : 255);
        },
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
        getFillColor: (d: any) => {
          return [255, 255, 255, 255];
        },
        getRadius: 280000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => {
          if (d.properties.id === selectedPulse) {
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
        getFillColor: (d: any) => {
          return getColor(d.properties.icu_code, 255);
        },
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => {
          if (d.properties.id === selectedPulse) {
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
