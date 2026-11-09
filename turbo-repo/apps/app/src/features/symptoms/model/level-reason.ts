/**
 * The case reached `icu_code` at `at`. A speed case's change also has its
 * speed and the limit it was compared with, in km/h.
 */
export type LevelStep = {
  at: string;
  icu_code: number;
  speed?: number | null;
  speed_limit?: number | null;
  speed_limit_source?: string | null;
  speed_limit_zone?: string | null;
};

/** Why an engine case is at its level, from the treatment header. */
export type LevelReason = {
  icu_code: number;
  icu_condition?: string | null;
  /** The level's rule in the symptom version that opened the case. */
  rule?: string | null;
  /** What the rules read when the case reached its level; null when not kept. */
  context?: Record<string, unknown> | null;
  /** For a lost signal: the last frame before the silence. */
  lost_since?: string | null;
  levels?: LevelStep[];
};

/**
 * The case's level at `at`: the level of its latest change at or before it.
 * A frame before the case's first change (a lost signal starts before the case
 * opens) takes the first level. Null outside the case.
 */
export function levelAt(
  at: string | number | Date,
  start: string | null | undefined,
  end: string | null | undefined,
  steps: LevelStep[] | null | undefined,
  fallback: number
): number | null {
  const t = new Date(at).getTime();
  const from = start ? new Date(start).getTime() : Number.NaN;
  const to = end ? new Date(end).getTime() : Number.NaN;
  if (Number.isNaN(t) || Number.isNaN(from) || t < from) return null;
  if (!Number.isNaN(to) && t > to) return null;
  const sorted = [...(steps ?? [])]
    .map((s) => ({ at: new Date(s.at).getTime(), level: Number(s.icu_code) }))
    .filter((s) => !Number.isNaN(s.at) && Number.isFinite(s.level))
    .sort((a, b) => a.at - b.at);
  if (sorted.length === 0) return fallback;
  let level = sorted[0].level;
  for (const s of sorted) {
    if (s.at <= t) level = s.level;
  }
  return level;
}

/** A symptom's interval on the map, and its level then. */
export type CaseSpan = {
  start: string;
  end: string;
  level: number;
  name?: string | null;
  /** Engine cases: the level of each change, so the level follows the time. */
  steps?: LevelStep[];
};

type HeaderLike = {
  symptom_info?: { id?: number | string | null; name?: string | null } | null;
  timeline?: {
    conditions_agg?: {
      symptom_id?: number | string | null;
      start?: string | null;
      end?: string | null;
      icu_code?: string | number | null;
      type?: string | null;
    }[];
  }[];
  level_reason?: LevelReason | null;
};

/** The intervals of the page's symptom in its header's timeline. */
export function caseSpans(header: HeaderLike | null | undefined): CaseSpan[] {
  const id = header?.symptom_info?.id;
  if (id === undefined || id === null) return [];
  const spans: CaseSpan[] = [];
  for (const entry of header?.timeline ?? []) {
    for (const agg of entry.conditions_agg ?? []) {
      if (String(agg.symptom_id) !== String(id) || !agg.start || !agg.end)
        continue;
      spans.push({
        start: agg.start,
        end: agg.end,
        level: Number(agg.icu_code ?? header?.level_reason?.icu_code ?? 0),
        name: header?.symptom_info?.name ?? agg.type ?? null,
        steps: header?.level_reason?.levels,
      });
    }
  }
  return spans;
}

/** The symptom and its level at `at`, or null when no interval holds it. */
export function pointLevel(
  at: string | null | undefined,
  spans: CaseSpan[]
): { level: number; name: string | null } | null {
  if (!at) return null;
  let found: { level: number; name: string | null } | null = null;
  for (const span of spans) {
    const level = levelAt(at, span.start, span.end, span.steps, span.level);
    if (level !== null && level > 0 && (!found || level > found.level)) {
      found = { level, name: span.name ?? null };
    }
  }
  return found;
}

/**
 * The speed limit of the case change recorded at the frame's time,
 * or null: frames between changes keep no limit of their own.
 */
export function stepLimitAt(
  at: string | null | undefined,
  spans: CaseSpan[]
): { speed: number | null; limit: number; zone: string | null } | null {
  if (!at) return null;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return null;
  for (const span of spans) {
    for (const step of span.steps ?? []) {
      if (
        typeof step.speed_limit === "number" &&
        new Date(step.at).getTime() === t
      ) {
        return {
          speed: step.speed ?? null,
          limit: step.speed_limit,
          zone: step.speed_limit_zone ?? null,
        };
      }
    }
  }
  return null;
}
