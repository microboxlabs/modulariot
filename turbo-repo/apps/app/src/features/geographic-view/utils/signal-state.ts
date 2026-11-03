import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";
import { z } from "zod";

/**
 * Whether a vehicle's GPS signal is arriving, by the lost-signal detector's
 * threshold: offline once the time since its newest frame arrived passes the
 * silence the detector expects for it. Unknown without a profile.
 */
export const SignalStateSchema = z.object({
  state: z.enum(["online", "offline", "unknown"]),
  /** The newest frame's GPS time, only when offline. */
  offline_since: z.string().nullish(),
  last_frame_at: z.string().nullish(),
  silence_s: z.number().nullish(),
  expected_s: z.number().nullish(),
});

export type SignalState = z.infer<typeof SignalStateSchema>;

/** Flowbite gray-500 (#6B7280), the same gray as the disconnected pin. */
export const OFFLINE_GRAY: [number, number, number, number] = [
  107, 114, 128, 255,
];
/** Flowbite gray-700 (#374151) behind the white label text. */
export const OFFLINE_LABEL_BACKGROUND: [number, number, number, number] = [
  55, 65, 81, 235,
];

/** Past this many minutes the age is told in hours. */
const MINUTES_UP_TO = 90;

export function isOffline(signal: SignalState | null | undefined): boolean {
  return signal?.state === "offline";
}

/** How long ago the signal stopped: minutes up to 90, then whole hours. */
export function offlineAge(
  since: string,
  now: number
): { n: number; unit: "min" | "h" } | null {
  const at = Date.parse(since);
  if (Number.isNaN(at)) return null;
  const minutes = Math.max(1, Math.floor((now - at) / 60_000));
  if (minutes <= MINUTES_UP_TO) return { n: minutes, unit: "min" };
  return { n: Math.round(minutes / 60), unit: "h" };
}

/**
 * "Sin señal · hace 12 min" / "No signal · 12 min ago", or null when the
 * vehicle is not offline. `dict` is the whole dictionary.
 */
export function offlineLabel(
  signal: SignalState | null | undefined,
  dict: I18nRecord,
  now: number = Date.now()
): string | null {
  if (!isOffline(signal)) return null;
  const age = signal?.offline_since
    ? offlineAge(signal.offline_since, now)
    : null;
  if (!age) return tr("geographic_view.signal_offline", dict);
  const n = { n: String(age.n) };
  return age.unit === "min"
    ? tr("geographic_view.signal_offline_minutes", dict, n)
    : tr("geographic_view.signal_offline_hours", dict, n);
}

/**
 * Whether the frame at `timestamp` is the detector's newest frame of the
 * vehicle: a map whose positions end before it does not show where the
 * vehicle went silent. True when the state does not say.
 */
export function isNewestFrame(
  timestamp: string | null | undefined,
  signal: SignalState | null | undefined
): boolean {
  if (!signal?.last_frame_at) return true;
  return frameLag(timestamp, signal) === 0;
}

/** Stop polling only once the detector has moved beyond this static track. */
export function isHistoricalFrame(
  timestamp: string | null | undefined,
  signal: SignalState | null | undefined
): boolean {
  const lag = frameLag(timestamp, signal);
  return lag !== null && lag > 0;
}

function frameLag(
  timestamp: string | null | undefined,
  signal: SignalState | null | undefined
): number | null {
  if (!signal?.last_frame_at) return null;
  const at = timestamp ? Date.parse(timestamp) : Number.NaN;
  const newest = Date.parse(signal.last_frame_at);
  if (Number.isNaN(at) || Number.isNaN(newest)) return null;
  return newest - at;
}
