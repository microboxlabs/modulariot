/**
 * Filling a step's script from a case's context: `case`, `condition`, `trip`
 * and `vehicle`, as the server's script context gives them. A script writes a
 * field as `{{trip.driver.name}}`. The names scripts used before
 * (`{{patente}}`, `{{conductor}}`…) still fill.
 */

type Json = Record<string, unknown>;

/** The fields every case can have, offered when no sample case is at hand. */
export const SCRIPT_PATHS = [
  "case.symptom",
  "case.level",
  "case.levelName",
  "case.openedAt",
  "vehicle.plate",
  "trip.code",
  "trip.origin",
  "trip.destination",
  "trip.load",
  "trip.driver.name",
  "trip.driver.rut",
  "trip.driver.phone",
  "trip.secondDriver.name",
  "trip.carrier.name",
  "trip.carrier.rut",
] as const;

/** Older script variables and the field each one now reads. */
export const SCRIPT_ALIASES: Record<string, string> = {
  patente: "vehicle.plate",
  conductor: "trip.driver.name",
  transportista: "trip.carrier.name",
  origen: "trip.origin",
  destino: "trip.destination",
};

/** `{{ruta}}` reads two fields. */
const ROUTE = "ruta";

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const text = (v: unknown): string | null =>
  typeof v === "string" || typeof v === "number" || typeof v === "boolean"
    ? String(v)
    : null;

/** The value at a dotted path, or null when the context does not have it. */
export function valueAt(ctx: Json | undefined, path: string): string | null {
  let at: unknown = ctx;
  for (const key of path.split(".")) {
    if (!isObject(at)) return null;
    if (!Object.hasOwn(at, key)) return null;
    at = at[key];
  }
  const v = text(at);
  return v === "" ? null : v;
}

/** A script variable's value: a field path, or an older name. Null when the context lacks it. */
export function scriptValue(
  name: string,
  ctx: Json | undefined
): string | null {
  if (name === ROUTE) {
    const from = valueAt(ctx, "trip.origin");
    const to = valueAt(ctx, "trip.destination");
    return from && to ? `${from} → ${to}` : null;
  }
  return valueAt(
    ctx,
    Object.hasOwn(SCRIPT_ALIASES, name) ? SCRIPT_ALIASES[name]! : name
  );
}

/** Whether a variable is one a case can fill: a known field, an older name, or a field of the sample. */
export function isScriptVariable(name: string, ctx?: Json): boolean {
  if (name === ROUTE || Object.hasOwn(SCRIPT_ALIASES, name)) return true;
  if ((SCRIPT_PATHS as readonly string[]).includes(name)) return true;
  return ctx ? scriptValue(name, ctx) !== null : false;
}

/** Every leaf of the context as a dotted path with its value, for the variables panel. */
export function contextLeaves(
  ctx: Json | undefined,
  prefix = ""
): { path: string; value: string }[] {
  if (!ctx) return [];
  const out: { path: string; value: string }[] = [];
  for (const [key, v] of Object.entries(ctx)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isObject(v)) out.push(...contextLeaves(v, path));
    else {
      const t = text(v);
      if (t !== null) out.push({ path, value: t });
    }
  }
  return out;
}

/**
 * A piece of a script: plain text, or a variable with the context's value
 * (null when the case lacks it). `known` is false for a variable no case
 * fills.
 */
export type ScriptPart =
  | { text: string }
  | { variable: string; value: string | null; known: boolean };

const VARIABLE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** The script split into text and `{{variables}}`, each filled from the context when it has the field. */
export function scriptParts(
  script: string,
  ctx: Json | undefined
): ScriptPart[] {
  const parts: ScriptPart[] = [];
  let offset = 0;
  let start = script.indexOf("{{");
  while (start !== -1) {
    if (start > offset) parts.push({ text: script.slice(offset, start) });
    const end = script.indexOf("}}", start + 2);
    // Include unsupported and unfinished expressions so operator previews
    // can render named blanks instead of leaking template syntax.
    const name = script
      .slice(start + 2, end === -1 ? script.length : end)
      .replace(/[{}]/g, "")
      .trim();
    parts.push({
      variable: name,
      value: scriptValue(name, ctx),
      known: isScriptVariable(name, ctx),
    });
    offset = end === -1 ? script.length : end + 2;
    start = script.indexOf("{{", offset);
  }
  if (offset < script.length) parts.push({ text: script.slice(offset) });
  return parts;
}

/** The script with each variable the context has filled in; the rest stay as written. */
export function fillScriptText(script: string, ctx: Json | undefined): string {
  return script.replaceAll(
    VARIABLE,
    (all, name: string) => scriptValue(name, ctx) ?? all
  );
}

/** A filled piece of a script: text, or a field the case has no value for, named for the operator. */
export type FilledPart = { text: string } | { blank: string };

/** The names of the fields, as `scriptField` in the texts keys them (`trip_driver_name`). */
export type FieldLabels = Record<string, unknown> | undefined;

const lowerFirst = (s: string) =>
  /^\p{Lu}\p{Ll}/u.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

/** What the operator reads for a variable the case cannot fill: `[nombre del conductor]`. */
export function blankLabel(name: string, labels: FieldLabels): string {
  const label = (path: string) => {
    const key = path.replaceAll(".", "_");
    const v = labels && Object.hasOwn(labels, key) ? labels[key] : undefined;
    return lowerFirst(
      typeof v === "string" && v ? v : (path.split(".").pop() ?? path)
    );
  };
  if (name === ROUTE)
    return `[${label("trip.origin")} → ${label("trip.destination")}]`;
  return `[${label(Object.hasOwn(SCRIPT_ALIASES, name) ? SCRIPT_ALIASES[name]! : name)}]`;
}

/** The script with the case's values in place, and a named blank for each one the case lacks. */
export function filledParts(
  script: string,
  ctx: Json | undefined,
  labels: FieldLabels
): FilledPart[] {
  const out: FilledPart[] = [];
  for (const part of scriptParts(script, ctx)) {
    let piece: FilledPart;
    if ("text" in part) piece = { text: part.text };
    else if (part.value === null)
      piece = { blank: blankLabel(part.variable, labels) };
    else piece = { text: part.value };
    const last = out.at(-1);
    if ("text" in piece && last && "text" in last) last.text += piece.text;
    else out.push(piece);
  }
  return out;
}

/** The parts as plain text, blanks in brackets. */
export function partsText(parts: readonly FilledPart[]): string {
  return parts.map((p) => ("text" in p ? p.text : p.blank)).join("");
}
