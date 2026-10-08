import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";
import {
  isMobilePulse,
  isVisiblePulse,
  getMobilePulseRingColor,
} from "../../utils/pulse-source";

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

type PulseData = {
  assetid: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  signal_description?: string | null;
};

type DisplayRange = {
  startDate?: Date;
  endDate?: Date;
};

function isWithinDisplayRange(
  pulse: PulseData,
  displayRange?: DisplayRange
): boolean {
  if (!displayRange?.startDate || !displayRange.endDate) return true;

  const signalTimestamp = new Date(pulse.timestamp);
  const localSignalTimestamp = new Date(
    signalTimestamp.getTime() + signalTimestamp.getTimezoneOffset() * 60000
  );

  return (
    localSignalTimestamp >= new Date(displayRange.startDate) &&
    localSignalTimestamp <= new Date(displayRange.endDate)
  );
}

export function buildPulseKey(d: PulseData): string {
  return `${d.assetid}:${d.timestamp}:${d.latitude}:${d.longitude}`;
}

export class PulsePinLayer extends CompositeLayer<any> {
  renderLayers(): Layer[] {
    const displayRange = this.props.displayRange;
    const showStops = this.props.showStops || false;
    const showMobilePulses = this.props.showMobilePulses ?? true;
    const selectedPulseKey: string | null = this.props.selectedPulseKey || null;
    const ringColor = getMobilePulseRingColor(this.props.isDarkMap ?? true);

    // Check if data exists and is an array (raw HistoricSignal[])
    if (!this.props.data || !Array.isArray(this.props.data)) {
      return [];
    }

    // Filter valid data points
    const validData = this.props.data.filter(
      (d: PulseData) =>
        isValidCoordinate([d.longitude, d.latitude]) &&
        isVisiblePulse(d, showMobilePulses)
    );
    const mobileData = validData.filter(isMobilePulse);
    const selectedData = selectedPulseKey
      ? validData.filter(
          (d: PulseData) => buildPulseKey(d) === selectedPulseKey
        )
      : [];
    const selectedMobileData = selectedData.filter(isMobilePulse);

    return [
      new ScatterplotLayer({
        id: "pulse-background-layer",
        data: validData,
        getFillColor: (d: PulseData): [number, number, number, number] => {
          // When a pulse is selected, only show white border on that pulse
          if (
            selectedPulseKey !== null &&
            buildPulseKey(d) !== selectedPulseKey
          ) {
            return [255, 255, 255, 0];
          }
          return [255, 255, 255, 255];
        },
        getRadius: (d: PulseData) => (isMobilePulse(d) ? 9 : 7),
        getPosition:
          this.props.getPosition ||
          ((d: PulseData) => [d.longitude, d.latitude]),
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
          getFillColor: [selectedPulseKey],
        },
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-mobile-source-ring-layer",
        data: mobileData,
        getFillColor: (d: PulseData) =>
          isWithinDisplayRange(d, displayRange) ? ringColor : [0, 0, 0, 0],
        getRadius: 7,
        getPosition:
          this.props.getPosition ||
          ((d: PulseData) => [d.longitude, d.latitude]),
        parameters: { depthTest: false },
        radiusUnits: "pixels",
        pickable: false,
        updateTriggers: {
          getFillColor: [displayRange, this.props.isDarkMap],
        },
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-moving-vehicles-layer",
        data: validData,
        getFillColor: (d: PulseData) =>
          isWithinDisplayRange(d, displayRange) ? getColor(0) : [0, 0, 0, 0],
        getRadius: 5,
        getPosition:
          this.props.getPosition ||
          ((d: PulseData) => [d.longitude, d.latitude]),

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
      ...(selectedPulseKey
        ? [
            // White ring behind the selected pulse, rendered on top of everything
            new ScatterplotLayer({
              id: "pulse-selected-background",
              data: selectedData,
              getFillColor: [255, 255, 255, 255] as [
                number,
                number,
                number,
                number,
              ],
              getRadius: (d: PulseData) => (isMobilePulse(d) ? 9 : 7),
              getPosition:
                this.props.getPosition ||
                ((d: PulseData) => [d.longitude, d.latitude]),
              parameters: { depthTest: false },
              radiusUnits: "pixels" as const,
              pickable: false,
            }) as Layer,
            new ScatterplotLayer({
              id: "pulse-selected-mobile-source-ring",
              data: selectedMobileData,
              getFillColor: ringColor,
              getRadius: 7,
              getPosition:
                this.props.getPosition ||
                ((d: PulseData) => [d.longitude, d.latitude]),
              parameters: { depthTest: false },
              radiusUnits: "pixels" as const,
              pickable: false,
              updateTriggers: {
                getFillColor: [this.props.isDarkMap],
              },
            }) as Layer,
            // Original pulse color on top of the selected white ring
            new ScatterplotLayer({
              id: "pulse-selected-foreground",
              data: selectedData,
              getFillColor: getColor(0),
              getRadius: 5,
              getPosition:
                this.props.getPosition ||
                ((d: PulseData) => [d.longitude, d.latitude]),
              parameters: { depthTest: false },
              radiusUnits: "pixels" as const,
              pickable: false,
            }) as Layer,
          ]
        : []),
    ];
  }
}
