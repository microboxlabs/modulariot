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
        (d: any) => d.properties?.speed > 0 && this.isRenderableFeature(d)
      ) || []
    );
  }
}
