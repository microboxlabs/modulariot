/**
 * "Ignorar condición" on an engine case: the hold the modulith keeps while the
 * case is ignored, as the symptom list, the treatment header and the timeline
 * carry it. See `quarkus-srv/miot-symptoms/docs/control-tower-api.md`.
 */

export type IgnoreScope = "CASE" | "SYMPTOM" | "ALL";

/** A row's or header's `ignored`: `until` is null while it lasts until the trip ends. */
export interface IgnoredInfo {
  treatment_id: string;
  since: string;
  until: string | null;
  until_trip_end: boolean;
  scope: IgnoreScope | string;
  by: string | null;
}

/** `p_icu_code` / `icu_code` of the "Ignorados" filter. */
export const IGNORED_ICU_CODE = "9";

/** The durations offered, in seconds. */
export const IGNORE_DURATIONS = [300, 1800, 3600, 7200] as const;

/** The form's duration value for "Hasta que termine el viaje". */
export const UNTIL_TRIP_END = -1;

/** How a hold ended (`resolution` of its treatment). */
export const HOLD_ENDINGS: Record<string, string> = {
  resolved_after_ignore: "resolved_after_ignore",
  returned_after_ignore: "returned_after_ignore",
  ignored: "ignored_trip_ended",
};

/** Who ends a hold whose time ran out. */
export const SYSTEM_ACTOR = "system";

const SCOPES: Record<string, IgnoreScope> = {
  synthom: "CASE",
  same_synthoms: "SYMPTOM",
  all_synthoms: "ALL",
};

/** The form's scope option as the API's scope; CASE when unknown. */
export function towerScope(option: string | null | undefined): IgnoreScope {
  return SCOPES[option ?? ""] ?? "CASE";
}

/** A duration the form offers, else the shortest. */
export function offeredDuration(seconds: number, tripEndOffered: boolean) {
  if (seconds === UNTIL_TRIP_END && tripEndOffered) return seconds;
  return (IGNORE_DURATIONS as readonly number[]).includes(seconds)
    ? seconds
    : IGNORE_DURATIONS[0];
}

/** Seconds left on the hold at `now`, 0 once due; null until the trip ends. */
export function secondsLeft(
  info: Pick<IgnoredInfo, "until">,
  now: number = Date.now()
): number | null {
  if (!info.until) return null;
  const until = new Date(info.until).getTime();
  if (Number.isNaN(until)) return null;
  return Math.max(0, Math.round((until - now) / 1000));
}

/** "4 min", "1 h 05 min"; under a minute counts as one. */
export function formatLeft(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")} min`;
}
