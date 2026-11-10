import { Symptoms } from "@/features/symptoms/components/table-item.type";

/** One engine symptom's cases on a trip, as `/map/trips/{trip}/symptoms` answers. */
export type EngineTripSymptom = {
  definition_id: string;
  symptom_key: string | null;
  name: string;
  family: string | null;
  icon: string | null;
  cases: number;
  open_cases: number;
  max_level: number;
  max_condition: string | null;
  trip_id: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
};

/** What `/api/symptoms/trip` answers: the GPS database's rows, or the engine's symptoms. */
export type TripSymptoms =
  | { source: "legacy"; rows: Record<string, unknown>[] }
  | { source: "engine"; trip: string; symptoms: EngineTripSymptom[] };

/**
 * The route's body as {@link TripSymptoms}. An object with a `symptoms` array
 * is the engine's answer. Anything else is the legacy answer: an array, or
 * `null` or `{}` for a trip without rows.
 */
export function parseTripSymptoms(body: unknown): TripSymptoms {
  if (Array.isArray(body)) {
    return { source: "legacy", rows: body as Record<string, unknown>[] };
  }
  const value = (body ?? {}) as { trip?: unknown; symptoms?: unknown };
  if (!Array.isArray(value.symptoms)) {
    return { source: "legacy", rows: [] };
  }
  return {
    source: "engine",
    trip: typeof value.trip === "string" ? value.trip : "",
    symptoms: value.symptoms as EngineTripSymptom[],
  };
}

/** Icons of the platform templates that have no `icon`, by symptom key. */
const ICON_BY_KEY: Record<string, string> = {
  "eta-early": "Deviation_Eta_Early",
  "eta-late": "Deviation_Eta_Late",
  "driver-fatigue": "Fatigue And Drowsiness",
  "driver-fatigue-sensor": "Fatigue And Drowsiness Sensor",
};

const ICON_BY_FAMILY: Record<string, string> = {
  driving_safety: "SPEED LIMIT STANDARD",
  signal_continuity: "LOST SIGNAL",
  zones_places: "STAY RISK",
  workday_fatigue: "CONTINUOUS DRIVE CHECK",
  cargo: "NO CARGO SECURING",
  route_plan: "Deviation_Eta_Late",
};

export const DEFAULT_SYMPTOM_ICON = "CONTINUOUS DRIVE CHECK";

function known(icon: string | null | undefined): string | null {
  if (!icon) return null;
  if (Symptoms[icon]) return icon;
  const upper = icon.toUpperCase();
  return Symptoms[upper] ? upper : null;
}

/**
 * The `SymptomIcon` key of an engine symptom: its own `icon` when the app has
 * that image, else the one for its symptom key, else for its family, else the
 * default.
 */
export function engineSymptomIcon(
  symptom: Pick<EngineTripSymptom, "icon" | "symptom_key" | "family">
): string {
  return (
    known(symptom.icon) ??
    known(ICON_BY_KEY[symptom.symptom_key ?? ""]) ??
    known(ICON_BY_FAMILY[symptom.family ?? ""]) ??
    DEFAULT_SYMPTOM_ICON
  );
}

/** The `ConditionIcon` key of the highest level reached; none without cases. */
export function engineSymptomConditions(symptom: EngineTripSymptom): string[] {
  return symptom.cases > 0 && symptom.max_condition
    ? [symptom.max_condition.toLowerCase()]
    : [];
}

/**
 * The symptom list filtered to this symptom's cases on the trip, open or
 * closed: the history from its first case until a second after its latest.
 * Null without cases.
 */
export function engineSymptomListHref(
  lang: string,
  symptom: EngineTripSymptom
): string | null {
  if (
    symptom.cases === 0 ||
    !symptom.trip_id ||
    !symptom.first_opened_at ||
    !symptom.last_opened_at
  ) {
    return null;
  }
  const to = new Date(Date.parse(symptom.last_opened_at) + 1000);
  if (Number.isNaN(to.getTime())) return null;
  const params = new URLSearchParams({
    trip_id: symptom.trip_id,
    symptom_name: symptom.name,
    date_from: symptom.first_opened_at,
    date_to: to.toISOString(),
  });
  return `/${lang}/symptoms?${params.toString()}`;
}
