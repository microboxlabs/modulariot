/**
 * The symptom's close and note rules as form rows, and back.
 *
 * Close: rows joined by `||`, each one way the case ends, optionally only
 * while its level is at most n: `(case.normal_s >= 0 && case.level <= 3)`.
 * Note: rows joined by `||`, each a GPS event type that writes a note.
 * A rule the rows cannot say is edited as CEL only.
 */

/** One way a case closes by itself. */
export type CloseWhen =
  | { kind: "operator" }
  | { kind: "normal"; minutes: number }
  | { kind: "age"; hours: number }
  /** `path` is the source's trip-active field, such as `signal.trip.active`. */
  | { kind: "tripEnded"; path: string }
  /** `path` is the source's event list, such as `signal.frame.events`. */
  | { kind: "event"; path: string; eventType: string };

export type CloseKind = CloseWhen["kind"];

export interface CloseRow {
  when: CloseWhen;
  /** Only while the case's level is at most this; null at any level. */
  maxLevel: number | null;
}

/** A GPS event type that writes a note in the case's timeline. */
export interface NoteRow {
  path: string;
  eventType: string;
}

/** The source fields the rows need: its event list and its trip-active flag, when it has them. */
export interface CloseFields {
  events: string | null;
  tripActive: string | null;
}

/** Finds the event list and the trip-active flag among the CEL fields' paths. */
export function closeFields(paths: readonly string[]): CloseFields {
  return {
    events: paths.find((p) => /(^|\.)frame\.events$/.test(p)) ?? null,
    tripActive: paths.find((p) => /(^|\.)trip\.active$/.test(p)) ?? null,
  };
}

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const PATH = String.raw`([A-Za-z_][\w.]*)`;
const STRING = String.raw`("(?:[^"\\]|\\.)*")`;
const OPERATOR = /^case\.closed_by_operator(?:\s*==\s*true)?$/;
const NORMAL = new RegExp(String.raw`^case\.normal_s\s*>=\s*${NUMBER}$`);
const AGE = new RegExp(String.raw`^case\.age_h\s*>=\s*${NUMBER}$`);
const TRIP_ENDED_NOT = new RegExp(String.raw`^!\s*${PATH}$`);
const TRIP_ENDED_EQ = new RegExp(String.raw`^${PATH}\s*==\s*false$`);
const EVENT = new RegExp(
  String.raw`^${PATH}\.exists\(\s*e\s*,\s*e\.event_type\s*==\s*${STRING}\s*\)$`
);
const EVENTS_IN = new RegExp(
  String.raw`^${PATH}\.exists\(\s*e\s*,\s*e\.event_type\s+in\s+\[([^\]]*)\]\s*\)$`
);
const LEVEL = /^case\.level\s*<=\s*([1-4])$/;

/** Splits on a top-level operator (`||` or `&&`), outside quotes and parentheses; null when they do not balance. */
export function splitTop(text: string, op: "||" | "&&"): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  const atTopLevelOperator = (index: number) =>
    depth === 0 && text.startsWith(op, index);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") {
      depth--;
      if (depth < 0) return null;
    } else if (atTopLevelOperator(i)) {
      parts.push(text.slice(start, i).trim());
      start = i + op.length;
      i += op.length - 1;
    }
  }
  if (quote || depth !== 0) return null;
  parts.push(text.slice(start).trim());
  return parts;
}

/** Where the parenthesis opened at `open` closes, outside quotes; -1 when it does not. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  return -1;
}

/** The text without parentheses that wrap all of it. */
function unwrap(text: string): string {
  let t = text.trim();
  while (t.startsWith("(") && closingParen(t, 0) === t.length - 1) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

const decimal = (n: number) => String(Number(n.toFixed(6)));

// A row edit recompiles every threshold. Keep values that would be rounded in CEL mode.
function roundTrips(value: number, compiled: number): boolean {
  return Number.isFinite(value) && Number(decimal(compiled)) === value;
}

function parseEventString(quoted: string): string | null {
  try {
    return JSON.parse(quoted) as string;
  } catch {
    return null;
  }
}

function parseWhen(term: string, fields: CloseFields): CloseWhen | null {
  if (OPERATOR.test(term)) return { kind: "operator" };
  const normal = NORMAL.exec(term);
  if (normal) {
    const seconds = Number(normal[1]);
    const minutes = seconds / 60;
    return roundTrips(seconds, minutes * 60)
      ? { kind: "normal", minutes }
      : null;
  }
  const age = AGE.exec(term);
  if (age) {
    const hours = Number(age[1]);
    return roundTrips(hours, hours) ? { kind: "age", hours } : null;
  }
  const ended = TRIP_ENDED_NOT.exec(term) ?? TRIP_ENDED_EQ.exec(term);
  if (ended?.[1] === fields.tripActive)
    return { kind: "tripEnded", path: ended[1] };
  const event = EVENT.exec(term);
  if (event) {
    const eventType = parseEventString(event[2] ?? "");
    if (eventType !== null)
      return { kind: "event", path: event[1] ?? "", eventType };
  }
  return null;
}

function parseCloseRow(part: string, fields: CloseFields): CloseRow | null {
  const terms = splitTop(unwrap(part), "&&");
  if (!terms || terms.length > 2) return null;
  let maxLevel: number | null = null;
  let when: CloseWhen | null = null;
  for (const term of terms.map(unwrap)) {
    const level = LEVEL.exec(term);
    if (level && maxLevel === null) maxLevel = Number(level[1]);
    else if (when === null) {
      when = parseWhen(term, fields);
      if (when === null) return null;
    } else return null;
  }
  return when ? { when, maxLevel } : null;
}

/** The close rule as rows, or null when it says more than they can. An empty rule has no rows. */
export function parseCloseRows(
  rule: string | null | undefined,
  fields: CloseFields
): CloseRow[] | null {
  const text = (rule ?? "").trim();
  if (!text || unwrap(text) === "false") return [];
  const parts = splitTop(text, "||");
  if (!parts) return null;
  const rows: CloseRow[] = [];
  for (const part of parts) {
    const row = parseCloseRow(part, fields);
    if (!row) return null;
    rows.push(row);
  }
  return rows;
}

function compileWhen(when: CloseWhen): string {
  switch (when.kind) {
    case "operator":
      return "case.closed_by_operator";
    case "normal":
      return `case.normal_s >= ${decimal(when.minutes * 60)}`;
    case "age":
      return `case.age_h >= ${decimal(when.hours)}`;
    case "tripEnded":
      return `!${when.path}`;
    case "event":
      return `${when.path}.exists(e, e.event_type == ${JSON.stringify(when.eventType)})`;
  }
}

export function compileCloseRows(rows: readonly CloseRow[]): string {
  if (rows.length === 0) return "false";
  const parts = rows.map((r) => {
    const when = compileWhen(r.when);
    if (r.maxLevel === null) return when;
    const term = `${when} && case.level <= ${r.maxLevel}`;
    return rows.length > 1 ? `(${term})` : term;
  });
  return parts.join(" || ");
}

/** The note rule as rows, or null when it says more than they can. */
export function parseNoteRows(
  rule: string | null | undefined
): NoteRow[] | null {
  const text = (rule ?? "").trim();
  if (!text) return [];
  const parts = splitTop(text, "||");
  if (!parts) return null;
  const rows: NoteRow[] = [];
  for (const part of parts.map(unwrap)) {
    const one = EVENT.exec(part);
    if (one) {
      const eventType = parseEventString(one[2] ?? "");
      if (eventType === null) return null;
      rows.push({ path: one[1] ?? "", eventType });
      continue;
    }
    const many = EVENTS_IN.exec(part);
    if (!many) return null;
    const items = (many[2] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const item of items) {
      const eventType = parseEventString(item);
      if (eventType === null) return null;
      rows.push({ path: many[1] ?? "", eventType });
    }
  }
  return rows;
}

export function compileNoteRows(rows: readonly NoteRow[]): string {
  return rows
    .map(
      (r) =>
        `${r.path}.exists(e, e.event_type == ${JSON.stringify(r.eventType)})`
    )
    .join(" || ");
}
