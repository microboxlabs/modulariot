import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

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

// Helper function to validate coordinates
function isValidCoordinate(coords: any): boolean {
  return (
    coords &&
    Array.isArray(coords) &&
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number" &&
    !isNaN(coords[0]) &&
    !isNaN(coords[1])
  );
}

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const zoomLevel = this.props.zoom;
    const selectedPulse = this.props.selectedPulse || [];
    const displayRange = this.props.displayRange;

    const showStops = this.props.showStops || false;

    // Ensure data exists and has features
    if (!this.props.data || !this.props.data.features) {
      return [];
    }

    // Filter data for each layer to avoid null positions and validate coordinates
    const movingVehicles = this.props.data.features.filter(
      (d: any) =>
        d.properties?.speed > 0 && isValidCoordinate(d.geometry?.coordinates)
    );
    const stoppedVehicles = this.props.data.features.filter(
      (d: any) =>
        d.properties?.speed <= 0 &&
        showStops &&
        isValidCoordinate(d.geometry?.coordinates)
    );
    const selectedVehicles = this.props.data.features.filter(
      (d: any) =>
        selectedPulse.includes(d.properties?.id) &&
        isValidCoordinate(d.geometry?.coordinates)
    );
    const selectedStoppedVehicles = this.props.data.features.filter(
      (d: any) =>
        selectedPulse.includes(d.properties?.id) &&
        d.properties?.speed <= 0 &&
        showStops &&
        isValidCoordinate(d.geometry?.coordinates)
    );

    return [
      new ScatterplotLayer({
        id: "pulse-background-layer",
        data: this.props.data.features.filter((d: any) =>
          isValidCoordinate(d.geometry?.coordinates)
        ),
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
          getRadius: [zoomLevel],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
        pickable: true,
      }) as Layer,
      new ScatterplotLayer({
        id: "pulse-moving-vehicles-layer",
        data: movingVehicles,
        getFillColor: (d: any) => {
          // If no display range is set, show all elements normally
          if (
            !displayRange ||
            !displayRange.startDate ||
            !displayRange.endDate
          ) {
            return getColor(d.properties.icu_code);
          }

          // Handle timezone properly - normalize both timestamps to local timezone for comparison
          const signalTimestamp = new Date(d.properties.timestamp);
          const startTime = new Date(displayRange.startDate);
          const endTime = new Date(displayRange.endDate);

          // If the signal timestamp appears to be in UTC but should be treated as local time,
          // we need to adjust for timezone offset
          const localSignalTimestamp = new Date(
            signalTimestamp.getTime() +
              signalTimestamp.getTimezoneOffset() * 60000
          );

          // Show elements that are WITHIN the date range
          if (
            localSignalTimestamp >= startTime &&
            localSignalTimestamp <= endTime
          ) {
            return getColor(d.properties.icu_code);
          } else {
            // Hide elements outside the range by making them transparent
            return [0, 0, 0, 0];
          }
        },
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedPulse, displayRange],
          getPosition: [showStops],
          getRadius: [zoomLevel],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
        getZIndex: 1000,
      }) as Layer,
      new ScatterplotLayer({
        id: "pulse-stopped-vehicles-layer",
        data: stoppedVehicles,
        getFillColor: () => [240, 50, 50, 255],
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedPulse, displayRange],
          getPosition: [showStops],
          getRadius: [zoomLevel],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
      }) as Layer,
      new ScatterplotLayer({
        id: "pulse-selected-background-layer",
        data: selectedVehicles,
        getFillColor: () => [255, 255, 255, 255],
        getRadius: 280000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse],
          getPosition: [showStops],
          getRadius: [zoomLevel],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
      }) as Layer,
      new ScatterplotLayer({
        id: "pulse-selected-vehicles-layer",
        data: selectedVehicles,
        getFillColor: (d: any) =>
          d.properties.speed > 0 || !showStops
            ? getColor(d.properties.icu_code)
            : [240, 50, 50, 255],
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse, showStops],
          getRadius: [zoomLevel],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
      }) as Layer,
      new ScatterplotLayer({
        id: "pulse-selected-stopped-vehicles-layer",
        data: selectedStoppedVehicles,
        getFillColor: (_d: any) => {
          return [240, 50, 50, 255];
        },
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition: (d: any) => d.geometry.coordinates,
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
          getFillColor: [selectedPulse, showStops],
          getRadius: [zoomLevel],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
      }) as Layer,
    ];
  }
}
