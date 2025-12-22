import { CompositeLayer, Layer } from "deck.gl";
import {
  getColor,
  isValidCoordinate,
  createScatterplotLayer,
  filterDataBySpeed,
  filterDataBySelection,
} from "./pulse-utils";

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const zoomLevel = this.props.zoom;
    const selectedPulse = this.props.selectedPulse || [];
    const displayPosition = this.props.displayPosition || 0;
    const showStops = this.props.showStops || false;

    if (!this.props.data?.features) return [];

    const validFeatures = this.props.data.features.filter((d: any) =>
      isValidCoordinate(d.geometry?.coordinates)
    );
    const movingVehicles = filterDataBySpeed(
      this.props.data.features,
      "moving"
    );
    const stoppedVehicles = filterDataBySpeed(
      this.props.data.features,
      "stopped",
      showStops
    );
    const selectedVehicles = filterDataBySelection(
      this.props.data.features,
      selectedPulse
    );
    const selectedStoppedVehicles = this.props.data.features.filter(
      (d: any) =>
        selectedPulse.includes(d.properties?.id) &&
        d.properties?.speed <= 0 &&
        showStops &&
        isValidCoordinate(d.geometry?.coordinates)
    );

    const baseRadius = 200000 / Math.pow(1.85, zoomLevel);
    const bgRadius = 280000 / Math.pow(1.85, zoomLevel);

    return [
      createScatterplotLayer({
        id: "pulse-background-layer",
        data: validFeatures,
        getFillColor: () => [
          255,
          255,
          255,
          selectedPulse.length === 0 ? 255 : 0,
        ],
        radius: bgRadius,
        updateTriggers: { getFillColor: [selectedPulse] },
      }),

      createScatterplotLayer({
        id: "pulse-moving-vehicles-layer",
        data: movingVehicles,
        getFillColor: (d: any) => {
          if (d.properties.id > displayPosition) {
            return [0, 0, 0, 0];
          }
          return getColor(d.properties.icu_code);
        },
        radius: baseRadius,
        zIndex: 1000,
        updateTriggers: {
          getFillColor: [selectedPulse, displayPosition],
          getPosition: [showStops],
        },
      }),

      createScatterplotLayer({
        id: "pulse-stopped-vehicles-layer",
        data: stoppedVehicles,
        getFillColor: () => [240, 50, 50, 255],
        radius: baseRadius,
        updateTriggers: {
          getFillColor: [selectedPulse, displayPosition],
          getPosition: [showStops],
        },
      }),

      createScatterplotLayer({
        id: "pulse-selected-background-layer",
        data: selectedVehicles,
        getFillColor: () => [255, 255, 255, 255],
        radius: bgRadius,
        updateTriggers: {
          getFillColor: [selectedPulse],
          getPosition: [showStops],
        },
      }),

      createScatterplotLayer({
        id: "pulse-selected-vehicles-layer",
        data: selectedVehicles,
        getFillColor: (d: any) =>
          d.properties.speed > 0 || !showStops
            ? getColor(d.properties.icu_code)
            : [240, 50, 50, 255],
        radius: baseRadius,
        updateTriggers: { getFillColor: [selectedPulse, showStops] },
      }),

      createScatterplotLayer({
        id: "pulse-selected-stopped-vehicles-layer",
        data: selectedStoppedVehicles,
        getFillColor: () => [240, 50, 50, 255],
        radius: baseRadius,
        updateTriggers: { getFillColor: [selectedPulse, showStops] },
      }),
    ];
  }
}
