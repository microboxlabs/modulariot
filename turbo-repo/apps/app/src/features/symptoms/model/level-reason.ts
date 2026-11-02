import { I18nRecord } from "@/features/i18n/i18n.service.types";
import { tr } from "@/features/i18n/tr.service";

/** The case reached `icu_code` at `at`. */
export type LevelStep = { at: string; icu_code: number };

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

export type ReasonLine = { key: string; label: string; value: string };

export type ReasonSummary = {
  /** Minutes without signal when the case reached its level, or null. */
  silenceMinutes: number | null;
  rule: string | null;
  /** Conditions that explain the level, such as a low-coverage zone. */
  flags: ReasonLine[];
  /** Every other value the rules read, labelled when known. */
  details: ReasonLine[];
};

type Value = string | number | boolean;

/** Lost-signal flags shown only when true, with their extra details. */
const FLAGS = ["low_coverage_zone", "cohort_outage", "returned", "backfill"];
/** Known values with a label; the others are shown by their path. */
const LABELLED = ["ratio", "expected_s", "nearby_reporting", "sender"];
/** Shown elsewhere in the card, or positions that the card leaves out. */
const SKIPPED = new Set([
  "check.signal_lost_minutes",
  "check.loss.silence_s",
  "check.loss.last.lat",
  "check.loss.last.lon",
  "check.loss.coverage_share",
  "check.loss.coverage_source",
]);

function leaves(
  value: unknown,
  path: string,
  out: Map<string, Value>
): Map<string, Value> {
  if (value === null || value === undefined) return out;
  if (typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      leaves(v, path ? `${path}.${k}` : k, out);
    }
  } else if (Array.isArray(value)) {
    out.set(path, value.map(String).join(", "));
  } else if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    out.set(path, value);
  }
  return out;
}

function number(value: Value | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function shown(value: Value, dict: I18nRecord): string {
  if (typeof value === "boolean")
    return value
      ? tr("symptoms.level_reason.yes", dict)
      : tr("symptoms.level_reason.no", dict);
  if (typeof value === "number")
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  return value;
}

function flagLine(
  key: string,
  values: Map<string, Value>,
  dict: I18nRecord
): ReasonLine {
  const label = tr(`symptoms.level_reason.flags.${key}`, dict);
  if (key !== "low_coverage_zone") return { key, label, value: "" };
  const parts: string[] = [];
  const share = number(values.get("check.loss.coverage_share"));
  if (share !== null) {
    const percent = share <= 1 ? share * 100 : share;
    parts.push(
      `${tr("symptoms.level_reason.coverage_share", dict)}: ${Math.round(percent)} %`
    );
  }
  const source = values.get("check.loss.coverage_source");
  if (source !== undefined && source !== "") {
    parts.push(
      `${tr("symptoms.level_reason.coverage_source", dict)}: ${String(source)}`
    );
  }
  return { key, label, value: parts.join(" · ") };
}

function detailLine(path: string, value: Value, dict: I18nRecord): ReasonLine {
  const key = path.split(".").pop() ?? path;
  if (path === "check.loss.last.at") {
    return {
      key: path,
      label: tr("symptoms.level_reason.last_frame", dict),
      value: String(value),
    };
  }
  if (path.startsWith("check.loss.") && LABELLED.includes(key)) {
    let text = shown(value, dict);
    if (key === "ratio" && typeof value === "number")
      text = `${value.toFixed(1)}×`;
    if (key === "expected_s" && typeof value === "number")
      text = `${Math.round(value)} s`;
    return {
      key: path,
      label: tr(`symptoms.level_reason.details.${key}`, dict),
      value: text,
    };
  }
  return { key: path, label: path, value: shown(value, dict) };
}

/**
 * What the card says about a case's level, from the stored context. Lost-signal
 * keys get labels; any other key is shown as its path and value, so a new
 * template still explains itself.
 */
export function summarizeReason(
  reason: LevelReason | null | undefined,
  dict: I18nRecord
): ReasonSummary | null {
  if (!reason) return null;
  const values = leaves(reason.context ?? null, "", new Map());
  const silenceS = number(values.get("check.loss.silence_s"));
  const lostMinutes = number(values.get("check.signal_lost_minutes"));
  let silenceMinutes: number | null = null;
  if (silenceS !== null) silenceMinutes = silenceS / 60;
  else if (lostMinutes !== null) silenceMinutes = lostMinutes;
  const flags: ReasonLine[] = [];
  const details: ReasonLine[] = [];
  for (const [path, value] of values) {
    if (SKIPPED.has(path)) continue;
    const key = path.split(".").pop() ?? path;
    if (path === `check.loss.${key}` && FLAGS.includes(key)) {
      if (value === true) flags.push(flagLine(key, values, dict));
      continue;
    }
    details.push(detailLine(path, value, dict));
  }
  return {
    silenceMinutes: silenceMinutes === null ? null : Math.round(silenceMinutes),
    rule: reason.rule?.trim() || null,
    flags,
    details,
  };
}

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
