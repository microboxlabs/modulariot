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

export function createScatterplotLayer(config: {
  id: string;
  data: any[];
  getFillColor: (d: any) => [number, number, number, number];
  radius: number;
  zIndex?: number;
  updateTriggers?: any;
  transitions?: any;
}): ScatterplotLayer {
  return new ScatterplotLayer({
    id: config.id,
    data: config.data,
    getFillColor: config.getFillColor,
    getRadius: config.radius,
    getPosition: (d: any) => d.geometry.coordinates,
    parameters: { depthTest: false },
    pickable: true,
    updateTriggers: config.updateTriggers || {},
    transitions: config.transitions,
    ...(config.zIndex && { getZIndex: config.zIndex }),
  });
}

export function filterDataBySpeed(
  features: any[],
  speed: "moving" | "stopped",
  showStops: boolean = false
): any[] {
  return features.filter((d: any) => {
    const isValidPos = isValidCoordinate(d.geometry?.coordinates);
    if (!isValidPos) return false;

    if (speed === "moving") {
      return d.properties?.speed > 0;
    } else {
      return d.properties?.speed <= 0 && showStops;
    }
  });
}

export function filterDataBySelection(
  features: any[],
  selectedIds: any[]
): any[] {
  return features.filter(
    (d: any) =>
      selectedIds.includes(d.properties?.id) &&
      isValidCoordinate(d.geometry?.coordinates)
  );
}

// Helper function for date range filtering
export function isWithinDateRange(
  timestamp: string,
  displayRange: any
): boolean {
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
