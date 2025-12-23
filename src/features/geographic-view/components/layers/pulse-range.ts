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
    const displayRange = this.props.displayRange;
    const showStops = this.props.showStops || false;

    console.log("data: ", this.props.data);

    // Check if data exists and is an array (raw HistoricSignal[])
    if (!this.props.data || !Array.isArray(this.props.data)) {
      return [];
    }

    // Filter valid data points
    const validData = this.props.data.filter((d: any) =>
      isValidCoordinate([d.longitude, d.latitude])
    );

    return [
      new ScatterplotLayer({
        id: "pulse-background-layer",
        data: validData,
        getFillColor: () => [255, 255, 255, 255],
        getRadius: 280000 / Math.pow(1.85, zoomLevel),
        getPosition:
          this.props.getPosition || ((d: any) => [d.longitude, d.latitude]),
        parameters: {
          depthTest: false,
        },
        updateTriggers: {
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
        data: validData,
        getFillColor: (d: any) => {
          // If no display range is set, show all elements normally
          if (
            !displayRange ||
            !displayRange.startDate ||
            !displayRange.endDate
          ) {
            return getColor(0);
          }

          // Handle timezone properly - normalize both timestamps to local timezone for comparison
          const signalTimestamp = new Date(d.timestamp);
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
            return getColor(0);
          } else {
            // Hide elements outside the range by making them transparent
            return [0, 0, 0, 0];
          }
        },
        getRadius: 200000 / Math.pow(1.85, zoomLevel),
        getPosition:
          this.props.getPosition || ((d: any) => [d.longitude, d.latitude]),

        parameters: {
          depthTest: false,
        },
        pickable: true,
        updateTriggers: {
          getFillColor: [displayRange],
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
    ];
  }
}
