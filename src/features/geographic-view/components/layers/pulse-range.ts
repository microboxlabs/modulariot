import { BasePulsePinLayer, getColor, isValidCoordinate } from "./pulse-base";

// Helper function for date range filtering
function isWithinDateRange(timestamp: string, displayRange: any): boolean {
  if (!displayRange || !displayRange.startDate || !displayRange.endDate) {
    return true; // Show all if no range is set
  }

  const signalTimestamp = new Date(timestamp);
  const startTime = new Date(displayRange.startDate);
  const endTime = new Date(displayRange.endDate);

  // Handle timezone properly - normalize both timestamps to local timezone for comparison
  const localSignalTimestamp = new Date(
    signalTimestamp.getTime() + signalTimestamp.getTimezoneOffset() * 60000
  );

  return localSignalTimestamp >= startTime && localSignalTimestamp <= endTime;
}

export class PulsePinLayer extends BasePulsePinLayer {
  protected getMovingVehicleColor(d: any): [number, number, number, number] {
    const displayRange = this.props.displayRange;
    if (!isWithinDateRange(d.properties.timestamp, displayRange)) {
      return [0, 0, 0, 0]; // Hide elements outside the range
    }
    return getColor(d.properties.icu_code);
  }
}
