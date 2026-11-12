import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";
import {
  getAppSignalRingColor,
  hasAppSignalDetail,
  isVisiblePulse,
} from "../../utils/pulse-source";
import { OFFLINE_GRAY } from "../../utils/signal-state";
import { LATE_FRAME_S } from "../../utils/frame-delays";

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
/** A late frame's dot (Tailwind gray-400): lateness is context, not an alarm. */
export const LATE_GRAY: [number, number, number, number] = [156, 163, 175, 255];

/** Radius of a pulse's dot, and of the white center of a stopped one. */
const DOT_RADIUS = 5;
const STOPPED_CENTER_RADIUS = 3;

/**
 * A stopped vehicle is a hollow dot: a dot in its level color (gray when the
 * frame came late), drawn with the other dots' colors, and a white center
 * drawn over every dot afterwards, so a neighbor's color never covers it. Red
 * fill is kept for symptoms. An offline vehicle's center is gray.
 */
export function stoppedDotProps<T>(
  levelOf: (d: T) => number,
  lateOf: (d: T) => boolean = () => false
) {
  return {
    getFillColor: (d: T) => (lateOf(d) ? LATE_GRAY : getColor(levelOf(d))),
    getRadius: DOT_RADIUS,
  };
}

/** The center of a stopped vehicle's dot: white, or gray while offline. */
export function stoppedCenterProps<T>(
  offlineOf: (d: T) => boolean = () => false
) {
  return {
    getFillColor: (d: T) => (offlineOf(d) ? OFFLINE_GRAY : WHITE),
    getRadius: STOPPED_CENTER_RADIUS,
    pickable: false,
  };
}

type PulseFeature = {
  properties?: {
    icu_code?: number;
    offline?: boolean;
    delay_s?: number | null;
  };
};

function levelOfFeature(d: PulseFeature): number {
  return d.properties?.icu_code ?? 0;
}

/** The vehicle's newest frame while its signal is not arriving. */
export function isOfflineFeature(d: PulseFeature): boolean {
  return d.properties?.offline === true;
}

/** A frame that reached the platform late: drawn gray instead of its color. */
export function isLateFeature(d: PulseFeature): boolean {
  const delay = d.properties?.delay_s;
  return typeof delay === "number" && delay >= LATE_FRAME_S;
}

/** The level color; gray for an offline vehicle, light gray for a late frame. */
export function pulseColor(d: PulseFeature): [number, number, number, number] {
  if (isOfflineFeature(d)) return OFFLINE_GRAY;
  if (isLateFeature(d)) return LATE_GRAY;
  return getColor(levelOfFeature(d));
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
      getRadius: DOT_RADIUS,
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
    const selectedPulse = new Set(this.props.selectedPulse);
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          selectedPulse.has(d.properties?.id) && this.isRenderableFeature(d)
      ) || []
    );
  }

  protected filterSelectedStoppedVehicles() {
    const selectedPulse = new Set(this.props.selectedPulse);
    const showStops = this.props.showStops || false;
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          selectedPulse.has(d.properties?.id) &&
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
        ...stoppedDotProps(levelOfFeature, isLateFeature),
        updateTriggers: {
          getFillColor: [
            selectedPulse,
            this.props.displayPosition,
            this.props.displayRange,
            this.props.data,
          ],
          getPosition: [showStops],
        },
        radiusUnits: "pixels",
      }) as Layer,

      // After every dot's color: no neighbor's color is drawn over a center.
      new ScatterplotLayer({
        id: "pulse-stopped-vehicles-center-layer",
        data: stoppedVehicles,
        ...this.getCommonLayerProps(),
        ...stoppedCenterProps(isOfflineFeature),
        updateTriggers: {
          getFillColor: [this.props.data],
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
        ...stoppedDotProps(levelOfFeature, isLateFeature),
        updateTriggers: {
          getFillColor: [selectedPulse, showStops, this.props.data],
        },
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-stopped-vehicles-center-layer",
        data: selectedStoppedVehicles,
        ...this.getCommonLayerProps(),
        ...stoppedCenterProps(isOfflineFeature),
        updateTriggers: {
          getFillColor: [this.props.data],
        },
        radiusUnits: "pixels",
      }) as Layer,
    ];
  }
}
