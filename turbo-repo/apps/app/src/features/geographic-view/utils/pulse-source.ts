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

/** Single list of `signal_description` values that classify as app GPS. */
const APP_SIGNAL_DESCRIPTIONS = new Set([
  "app_gps",
  "appgps",
  "app",
  "mobile",
  "mobile_app",
]);

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
  return isDarkMap
    ? APP_SIGNAL_RING_COLOR_DARK
    : APP_SIGNAL_RING_COLOR_LIGHT;
}

export function normalizeCsvColumnName(header: string): string {
  return header.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function fieldKeyFingerprint(key: string): string {
  return normalizeCsvColumnName(key).replaceAll(/[\s_-]+/g, "");
}

function coerceSignalDescription(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") {
    return null;
  }
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

function normalizeSignalDescription(value: string): string {
  return value.toLowerCase().replaceAll(/[\s-]+/g, "_");
}

/** Classify a raw description against `APP_SIGNAL_DESCRIPTIONS`. Call only at ingest. */
export function classifySignalDescription(
  description: string | null | undefined
): SignalDetail {
  if (description == null || description === "") return "unknown";
  const normalized = normalizeSignalDescription(description);
  if (normalized === "") return "unknown";
  if (APP_SIGNAL_DESCRIPTIONS.has(normalized)) return "app";
  return "gps";
}

export function mapCsvPulseRecord(
  record: Record<string, unknown>,
  longitude: number,
  latitude: number
): Record<string, unknown> {
  const signal_description = readSignalDescriptionField(record);
  const mapped: Record<string, unknown> = {
    ...record,
    longitude,
    latitude,
    signal_description,
    signal_detail: classifySignalDescription(signal_description),
  };
  for (const key of Object.keys(mapped)) {
    const fingerprint = fieldKeyFingerprint(key);
    if (
      fingerprint === "mobileorigin" ||
      fingerprint === "typesignaldescription" ||
      (fingerprint === "signaldescription" && key !== "signal_description") ||
      (fingerprint === "signaldetail" && key !== "signal_detail")
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

/** Stored classification from ingest. Does not re-run the app-description list. */
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
