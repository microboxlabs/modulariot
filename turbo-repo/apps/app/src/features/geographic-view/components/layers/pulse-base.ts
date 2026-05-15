import { CompositeLayer, Layer, ScatterplotLayer } from "deck.gl";

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

  protected filterValidFeatures() {
    if (!this.props.data?.features) return [];
    return this.props.data.features.filter((d: any) =>
      isValidCoordinate(d.geometry?.coordinates)
    );
  }

  protected filterMovingVehicles() {
    // In pulse-range context, we want to show all signals and filter by date range
    // The speed filtering is only relevant for the stopped vehicles layer
    return (
      this.props.data?.features?.filter((d: any) =>
        isValidCoordinate(d.geometry?.coordinates)
      ) || []
    );
  }

  protected filterStoppedVehicles() {
    const showStops = this.props.showStops || false;
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          d.properties?.speed <= 0 &&
          showStops &&
          isValidCoordinate(d.geometry?.coordinates)
      ) || []
    );
  }

  protected filterSelectedVehicles() {
    const selectedPulse = this.props.selectedPulse || [];
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          selectedPulse.includes(d.properties?.id) &&
          isValidCoordinate(d.geometry?.coordinates)
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
          isValidCoordinate(d.geometry?.coordinates)
      ) || []
    );
  }

  protected abstract getMovingVehicleColor(
    d: any
  ): [number, number, number, number];

  renderLayers(): Layer[] {
    const selectedPulse = this.props.selectedPulse || [];
    const showStops = this.props.showStops || false;

    if (!this.props.data?.features) return [];

    const validFeatures = this.filterValidFeatures();
    const movingVehicles = this.filterMovingVehicles();
    const stoppedVehicles = this.filterStoppedVehicles();
    const selectedVehicles = this.filterSelectedVehicles();
    const selectedStoppedVehicles = this.filterSelectedStoppedVehicles();

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
        updateTriggers: { getFillColor: [selectedPulse] },
        pickable: true,
        radiusUnits: "pixels",
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
        getFillColor: () => [240, 50, 50, 255],
        ...this.getCommonLayerProps(),
        updateTriggers: {
          getFillColor: [
            selectedPulse,
            this.props.displayPosition,
            this.props.displayRange,
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
        updateTriggers: {
          getFillColor: [selectedPulse],
          getPosition: [showStops],
        },
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-vehicles-layer",
        data: selectedVehicles,
        getFillColor: (d: any) =>
          d.properties.speed > 0 || !showStops
            ? getColor(d.properties.icu_code)
            : [240, 50, 50, 255],
        ...this.getCommonLayerProps(),
        updateTriggers: { getFillColor: [selectedPulse, showStops] },
        radiusUnits: "pixels",
      }) as Layer,

      new ScatterplotLayer({
        id: "pulse-selected-stopped-vehicles-layer",
        data: selectedStoppedVehicles,
        getFillColor: () => [240, 50, 50, 255],
        ...this.getCommonLayerProps(),
        updateTriggers: { getFillColor: [selectedPulse, showStops] },
        radiusUnits: "pixels",
      }) as Layer,
    ];
  }
}
