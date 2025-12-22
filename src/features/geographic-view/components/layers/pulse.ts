import { BasePulsePinLayer, getColor } from "./pulse-base";

export class PulsePinLayer extends BasePulsePinLayer {
  protected getMovingVehicleColor(d: any): [number, number, number, number] {
    const displayPosition = this.props.displayPosition || 0;
    if (d.properties.id > displayPosition) {
      return [0, 0, 0, 0];
    }
    return getColor(d.properties.icu_code);
  }

  protected filterMovingVehicles() {
    // For pulse.ts, we filter by speed > 0
    return (
      this.props.data?.features?.filter(
        (d: any) =>
          d.properties?.speed > 0 &&
          this.isValidCoordinate(d.geometry?.coordinates)
      ) || []
    );
  }

  private isValidCoordinate(coords: any): boolean {
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
}
