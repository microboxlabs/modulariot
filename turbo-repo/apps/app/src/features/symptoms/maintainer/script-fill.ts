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
  let last = 0;
  for (const match of script.matchAll(VARIABLE)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: script.slice(last, at) });
    const name = match[1] ?? "";
    parts.push({
      variable: name,
      value: scriptValue(name, ctx),
      known: isScriptVariable(name, ctx),
    });
    last = at + match[0].length;
  }
  if (last < script.length) parts.push({ text: script.slice(last) });
  return parts;
}

/** The script with each variable the context has filled in; the rest stay as written. */
export function fillScriptText(script: string, ctx: Json | undefined): string {
  return script.replaceAll(
    VARIABLE,
    (all, name: string) => scriptValue(name, ctx) ?? all
  );
}
