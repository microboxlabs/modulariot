export interface PulseSourceData {
  signal_description?: string | number | null;
  properties?: {
    signal_description?: string | number | null;
  };
}

export interface PulseSourceCounts {
  mobile: number;
  gps: number;
}

// Saved examples:
// Smalt 400 "#35B7FF" / [53, 183, 255, 255]
// Blaze 400 "#FF8837" / [255, 136, 55, 255]
const DARK_MAP_STYLES = new Set(["satellite", "dark", "hybrid"]);
const APP_SIGNAL_DESCRIPTIONS = new Set([
  "app_gps",
  "appgps",
  "app",
  "mobile",
  "mobile_app",
]);

export const MOBILE_PULSE_RING_HEX_DARK = "#FFCE00";
export const MOBILE_PULSE_RING_HEX_LIGHT = "#D18900";

export const MOBILE_PULSE_RING_COLOR_DARK: [number, number, number, number] = [
  255, 206, 0, 255,
];

export const MOBILE_PULSE_RING_COLOR_LIGHT: [number, number, number, number] = [
  209, 137, 0, 255,
];

export function isDarkMapStyle(style: string): boolean {
  return DARK_MAP_STYLES.has(style);
}

export function getMobilePulseRingHex(isDarkMap: boolean): string {
  return isDarkMap ? MOBILE_PULSE_RING_HEX_DARK : MOBILE_PULSE_RING_HEX_LIGHT;
}

export function getMobilePulseRingColor(
  isDarkMap: boolean
): [number, number, number, number] {
  return isDarkMap
    ? MOBILE_PULSE_RING_COLOR_DARK
    : MOBILE_PULSE_RING_COLOR_LIGHT;
}

export function normalizeCsvColumnName(header: string): string {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function fieldKeyFingerprint(key: string): string {
  return normalizeCsvColumnName(key).replaceAll(/[\s_-]+/g, "");
}

function coerceSignalDescription(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  return value === "" ? null : value;
}

function readSignalDescriptionField(
  record: Record<string, unknown>
): string | null {
  let fromType: string | null = null;
  let fromSignal: string | null = null;
  for (const [key, value] of Object.entries(record)) {
    const fingerprint = fieldKeyFingerprint(key);
    if (fingerprint === "signaldescription") {
      fromSignal = coerceSignalDescription(value);
    } else if (fingerprint === "typesignaldescription") {
      fromType = coerceSignalDescription(value);
    }
  }
  return fromSignal ?? fromType;
}

export function mapCsvPulseRecord(
  record: Record<string, unknown>,
  longitude: number,
  latitude: number
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {
    ...record,
    longitude,
    latitude,
    signal_description: readSignalDescriptionField(record),
  };
  for (const key of Object.keys(mapped)) {
    const fingerprint = fieldKeyFingerprint(key);
    if (
      fingerprint === "mobileorigin" ||
      fingerprint === "typesignaldescription" ||
      (fingerprint === "signaldescription" && key !== "signal_description")
    ) {
      delete mapped[key];
    }
  }
  return mapped;
}

export function getSignalDescription(pulse: PulseSourceData): string {
  const raw = pulse.signal_description ?? pulse.properties?.signal_description;
  if (raw == null) return "";
  return String(raw).trim();
}

function normalizeSignalDescription(value: string): string {
  return value.toLowerCase().replaceAll(/[\s-]+/g, "_");
}

export function isMobilePulse(pulse: PulseSourceData): boolean {
  const description = normalizeSignalDescription(getSignalDescription(pulse));
  return APP_SIGNAL_DESCRIPTIONS.has(description);
}

export function isVisiblePulse(
  pulse: PulseSourceData,
  showMobilePulses: boolean
): boolean {
  return showMobilePulses || !isMobilePulse(pulse);
}

export function countPulseSources(
  pulses: readonly PulseSourceData[]
): PulseSourceCounts {
  const mobile = pulses.filter(isMobilePulse).length;
  return {
    mobile,
    gps: pulses.length - mobile,
  };
}
