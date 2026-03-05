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
    const displayRange = this.props.displayRange;
    const showStops = this.props.showStops || false;
    const selectedPulseTimestamp: string | null =
      this.props.selectedPulseTimestamp || null;

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
        getFillColor: (d: any): [number, number, number, number] => {
          // When a pulse is selected, only show white border on that pulse
          if (
            selectedPulseTimestamp !== null &&
            d.timestamp !== selectedPulseTimestamp
          ) {
            return [255, 255, 255, 0];
          }
          return [255, 255, 255, 255];
        },
        getRadius: 7,
        getPosition:
          this.props.getPosition || ((d: any) => [d.longitude, d.latitude]),
        parameters: {
          depthTest: false,
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
        radiusUnits: "pixels",
        pickable: true,
        updateTriggers: {
          getFillColor: [selectedPulseTimestamp],
        },
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
        getRadius: 5,
        getPosition:
          this.props.getPosition || ((d: any) => [d.longitude, d.latitude]),

        parameters: {
          depthTest: false,
        },
        pickable: true,
        updateTriggers: {
          getFillColor: [displayRange],
          getPosition: [showStops],
        },
        transitions: {
          getRadius: {
            duration: 300,
            easing: (t: number) => t * t * (3 - 2 * t), // smooth step
          },
        },
        getZIndex: 1000,
        radiusUnits: "pixels",
      }) as Layer,
      ...(selectedPulseTimestamp
        ? [
            // White ring behind the selected pulse, rendered on top of everything
            new ScatterplotLayer({
              id: "pulse-selected-background",
              data: validData.filter(
                (d: any) => d.timestamp === selectedPulseTimestamp
              ),
              getFillColor: [255, 255, 255, 255] as [
                number,
                number,
                number,
                number,
              ],
              getRadius: 7,
              getPosition:
                this.props.getPosition ||
                ((d: any) => [d.longitude, d.latitude]),
              parameters: { depthTest: false },
              radiusUnits: "pixels" as const,
              pickable: false,
            }) as Layer,
            // Blue dot for the selected pulse, on top of its white ring
            new ScatterplotLayer({
              id: "pulse-selected-foreground",
              data: validData.filter(
                (d: any) => d.timestamp === selectedPulseTimestamp
              ),
              getFillColor: getColor(0),
              getRadius: 5,
              getPosition:
                this.props.getPosition ||
                ((d: any) => [d.longitude, d.latitude]),
              parameters: { depthTest: false },
              radiusUnits: "pixels" as const,
              pickable: false,
            }) as Layer,
          ]
        : []),
    ];
  }
}
