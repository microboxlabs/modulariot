import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";
import {
  getAppSignalRingColor,
  hasAppSignalDetail,
  isVisiblePulse,
} from "../../utils/pulse-source";
import { OFFLINE_GRAY } from "../../utils/signal-state";

export function getColor(icu_code: number): [number, number, number, number] {
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

const WHITE: [number, number, number, number] = [255, 255, 255, 255];

/**
 * A stopped vehicle is a hollow dot: white inside, ringed in its level color.
 * Red fill is kept for symptoms. An offline vehicle is filled gray, stopped
 * or not.
 */
export function stoppedMarkProps<T>(
  levelOf: (d: T) => number,
  offlineOf: (d: T) => boolean = () => false
) {
  return {
    getFillColor: (d: T) => (offlineOf(d) ? OFFLINE_GRAY : WHITE),
    getLineColor: (d: T) => getColor(levelOf(d)),
    stroked: true,
    getLineWidth: 2,
    lineWidthUnits: "pixels" as const,
  };
}

type PulseFeature = { properties?: { icu_code?: number; offline?: boolean } };

function levelOfFeature(d: PulseFeature): number {
  return d.properties?.icu_code ?? 0;
}

/** The vehicle's newest frame while its signal is not arriving. */
export function isOfflineFeature(d: PulseFeature): boolean {
  return d.properties?.offline === true;
}

/** The level color, or gray for an offline vehicle. */
export function pulseColor(d: PulseFeature): [number, number, number, number] {
  return isOfflineFeature(d) ? OFFLINE_GRAY : getColor(levelOfFeature(d));
}

export function isValidCoordinate(coords: any): boolean {
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

export interface PulseLayerProps {
  zoom: number;
  selectedPulse?: any[];
  showStops?: boolean;
  showAppSignalDetail?: boolean;
  isDarkMap?: boolean;
  data?: { features: any[] };
  displayPosition?: number;
  displayRange?: { startDate: Date; endDate: Date };
  getPosition?: (d: any) => [number, number];
  [key: string]: any; // Allow additional props
}

export abstract class BasePulsePinLayer extends CompositeLayer<any> {
  protected getCommonLayerProps() {
    const transitions = {
      getRadius: {
        duration: 300,
        easing: (t: number) => t * t * (3 - 2 * t),
      },
    };

    return {
      getRadius: 5,
      getPosition:
        this.props.getPosition || ((d: any) => d.geometry.coordinates),
      parameters: { depthTest: false },
      pickable: true,
      transitions,
    };
  }

  protected getBackgroundLayerProps() {
    const transitions = {
      getRadius: {
        duration: 300,
        easing: (t: number) => t * t * (3 - 2 * t),
      },
    };

    return {
      getRadius: 7,
      getPosition:
        this.props.getPosition || ((d: any) => d.geometry.coordinates),
      parameters: { depthTest: false },
      transitions,
    };
  }

  protected isRenderableFeature(d: any): boolean {
    if (!isValidCoordinate(d.geometry?.coordinates)) return false;
    return isVisiblePulse(d.properties, this.props.showAppSignalDetail ?? true);
  }

  protected filterValidFeatures() {
    if (!this.props.data?.features) return [];
    return this.props.data.features.filter((d: any) =>
      this.isRenderableFeature(d)
    );
  }

  protected filterMovingVehicles() {
    // In pulse-range context, we want to show all signals and filter by date range
    // The speed filtering is only relevant for the stopped vehicles layer
    return (
      this.props.data?.features?.filter((d: any) =>
        this.isRenderableFeature(d)
      ) || []
    );
  }

  protected filterStoppedVehicles() {
    const showStops = this.props.showStops || false;
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          d.properties?.speed <= 0 && showStops && this.isRenderableFeature(d)
      ) || []
    );
  }

  protected filterSelectedVehicles() {
    const selectedPulse = this.props.selectedPulse || [];
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          selectedPulse.includes(d.properties?.id) &&
          this.isRenderableFeature(d)
      ) || []
    );
  }

  protected filterSelectedStoppedVehicles() {
    const selectedPulse = this.props.selectedPulse || [];
    const showStops = this.props.showStops || false;
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          selectedPulse.includes(d.properties?.id) &&
          d.properties?.speed <= 0 &&
          showStops &&
          this.isRenderableFeature(d)
      ) || []
    );
  }

  protected abstract getMovingVehicleColor(
    d: any
  ): [number, number, number, number];

  renderLayers(): Layer[] {
    const selectedPulse = this.props.selectedPulse || [];
    const showStops = this.props.showStops || false;
    const ringColor = getAppSignalRingColor(this.props.isDarkMap ?? true);

    if (!this.props.data?.features) return [];

    const validFeatures = this.filterValidFeatures();
    const appFeatures = validFeatures.filter((d: any) =>
      hasAppSignalDetail(d.properties)
    );
    const movingVehicles = this.filterMovingVehicles();
    const stoppedVehicles = this.filterStoppedVehicles();
    const selectedVehicles = this.filterSelectedVehicles();
    const selectedStoppedVehicles = this.filterSelectedStoppedVehicles();
    const selectedAppFeatures = selectedVehicles.filter((d: any) =>
      hasAppSignalDetail(d.properties)
    );

    return [
      new ScatterplotLayer({
        id: "pulse-background-layer",
        data: validFeatures,
        getFillColor: () => [
          255,
          255,
          255,
          selectedPulse.length === 0 ? 255 : 0,
        ],
        ...this.getBackgroundLayerProps(),
        getRadius: (d: any) => (hasAppSignalDetail(d.properties) ? 9 : 7),
        updateTriggers: { getFillColor: [selectedPulse] },
        pickable: true,
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-app-signal-ring-layer",
        data: appFeatures,
        getFillColor: (d: any) =>
          this.props.displayPosition !== undefined &&
          d.properties.id > this.props.displayPosition
            ? [0, 0, 0, 0]
            : ringColor,
        ...this.getBackgroundLayerProps(),
        getRadius: 7,
        pickable: false,
        radiusUnits: "pixels",
        updateTriggers: {
          getFillColor: [this.props.displayPosition, this.props.isDarkMap],
        },
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-moving-vehicles-layer",
        data: movingVehicles,
        getFillColor: this.getMovingVehicleColor.bind(this),
        ...this.getCommonLayerProps(),
        updateTriggers: {
          getFillColor: [
            selectedPulse,
            this.props.displayPosition,
            this.props.displayRange,
          ],
          getPosition: [showStops],
        },
        getZIndex: 1000,
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-stopped-vehicles-layer",
        data: stoppedVehicles,
        ...this.getCommonLayerProps(),
        ...stoppedMarkProps(levelOfFeature, isOfflineFeature),
        updateTriggers: {
          getFillColor: [this.props.data],
          getLineColor: [
            selectedPulse,
            this.props.displayPosition,
            this.props.displayRange,
            this.props.data,
          ],
          getPosition: [showStops],
        },
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-background-layer",
        data: selectedVehicles,
        getFillColor: () => [255, 255, 255, 255],
        ...this.getBackgroundLayerProps(),
        getRadius: (d: any) => (hasAppSignalDetail(d.properties) ? 9 : 7),
        updateTriggers: {
          getFillColor: [selectedPulse],
          getPosition: [showStops],
        },
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-app-signal-ring-layer",
        data: selectedAppFeatures,
        getFillColor: ringColor,
        ...this.getBackgroundLayerProps(),
        getRadius: 7,
        pickable: false,
        radiusUnits: "pixels",
        updateTriggers: {
          getFillColor: [this.props.isDarkMap],
        },
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-vehicles-layer",
        data: selectedVehicles.filter(
          (d: any) => d.properties.speed > 0 || !showStops
        ),
        getFillColor: pulseColor,
        ...this.getCommonLayerProps(),
        updateTriggers: {
          getFillColor: [selectedPulse, showStops, this.props.data],
        },
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-stopped-vehicles-layer",
        data: selectedStoppedVehicles,
        ...this.getCommonLayerProps(),
        ...stoppedMarkProps(levelOfFeature, isOfflineFeature),
        updateTriggers: {
          getFillColor: [this.props.data],
          getLineColor: [selectedPulse, showStops, this.props.data],
        },
        radiusUnits: "pixels",
      }) as Layer,
    ];
  }
}
