export type SignalDetail = "app" | "gps" | "unknown";

export interface PulseSourceData {
  signal_description?: string | number | null;
  signal_detail?: SignalDetail | null;
  properties?: {
    signal_description?: string | number | null;
    signal_detail?: SignalDetail | null;
  };
}

export interface PulseSourceCounts {
  app: number;
  gps: number;
  unknown: number;
}

// Saved examples:
// Smalt 400 "#35B7FF" / [53, 183, 255, 255]
// Blaze 400 "#FF8837" / [255, 136, 55, 255]
const DARK_MAP_STYLES = new Set(["satellite", "dark", "hybrid"]);

export const APP_SIGNAL_RING_HEX_DARK = "#FFCE00";
export const APP_SIGNAL_RING_HEX_LIGHT = "#D18900";

export const APP_SIGNAL_RING_COLOR_DARK: [number, number, number, number] = [
  255, 206, 0, 255,
];

export const APP_SIGNAL_RING_COLOR_LIGHT: [number, number, number, number] = [
  209, 137, 0, 255,
];

export function isDarkMapStyle(style: string): boolean {
  return DARK_MAP_STYLES.has(style);
}

export function getAppSignalRingHex(isDarkMap: boolean): string {
  return isDarkMap ? APP_SIGNAL_RING_HEX_DARK : APP_SIGNAL_RING_HEX_LIGHT;
}

export function getAppSignalRingColor(
  isDarkMap: boolean
): [number, number, number, number] {
  return isDarkMap ? APP_SIGNAL_RING_COLOR_DARK : APP_SIGNAL_RING_COLOR_LIGHT;
}

export function getSignalDescription(pulse: PulseSourceData): string {
  const raw = pulse.signal_description ?? pulse.properties?.signal_description;
  if (raw == null) return "";
  return String(raw).trim();
}

/** The stored classification of the pulse. */
export function getSignalDetail(pulse: PulseSourceData): SignalDetail {
  return pulse.signal_detail ?? pulse.properties?.signal_detail ?? "unknown";
}

export function hasAppSignalDetail(pulse: PulseSourceData): boolean {
  return getSignalDetail(pulse) === "app";
}

export function isVisiblePulse(
  pulse: PulseSourceData,
  showAppSignalDetail: boolean
): boolean {
  return showAppSignalDetail || !hasAppSignalDetail(pulse);
}

export function filterVisiblePulses<T extends PulseSourceData>(
  pulses: readonly T[],
  showAppSignalDetail: boolean
): T[] {
  return pulses.filter((pulse) => isVisiblePulse(pulse, showAppSignalDetail));
}

export function countPulseSources(
  pulses: readonly PulseSourceData[]
): PulseSourceCounts {
  let app = 0;
  let gps = 0;
  let unknown = 0;
  for (const pulse of pulses) {
    const detail = getSignalDetail(pulse);
    if (detail === "app") app += 1;
    else if (detail === "gps") gps += 1;
    else unknown += 1;
  }
  return { app, gps, unknown };
}
