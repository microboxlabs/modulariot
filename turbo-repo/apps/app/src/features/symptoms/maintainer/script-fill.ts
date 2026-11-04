/** Script variables the treatment screen fills from the case's trip (`fillScript` in the call center). */
export const SCRIPT_VARIABLES = [
  "patente",
  "conductor",
  "transportista",
  "ruta",
  "origen",
  "destino",
] as const;

export type ScriptVariable = (typeof SCRIPT_VARIABLES)[number];

/** The sample fields each variable is read from for the preview, first match wins. */
const SOURCES: Record<ScriptVariable, string[]> = {
  patente: ["plate"],
  conductor: ["driver_name", "driver"],
  transportista: ["carrier_name", "carrier"],
  ruta: ["route"],
  origen: ["origin_geofence_label", "origin"],
  destino: ["destination_geofence_label", "destination"],
};

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const isKnown = (name: string): name is ScriptVariable =>
  Object.hasOwn(SOURCES, name);

/** The first value under `key` anywhere in the sample, depth first. */
function find(sample: Json, key: string): unknown {
  for (const [k, v] of Object.entries(sample)) {
    if (k === key) return v;
    if (isObject(v)) {
      const inner = find(v, key);
      if (inner !== undefined) return inner;
    }
  }
  return undefined;
}

/** A variable's value in the sample, or null when the sample lacks it. */
export function scriptValue(
  name: string,
  sample: Json | undefined
): string | null {
  if (!sample || !isKnown(name)) return null;
  for (const key of SOURCES[name]) {
    const v = find(sample, key);
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  return null;
}

/**
 * A piece of a script: plain text, or a variable with the sample's value (null
 * when the sample lacks it). `known` is false for a variable the treatment
 * screen does not fill.
 */
export type ScriptPart =
  | { text: string }
  | { variable: string; value: string | null; known: boolean };

/** The script split into text and `{{variables}}`, each variable filled from the sample when it has the field. */
export function scriptParts(
  script: string,
  sample: Json | undefined
): ScriptPart[] {
  const parts: ScriptPart[] = [];
  const pattern = /\{\{\s*(\w+)\s*\}\}/g;
  let last = 0;
  for (const match of script.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ text: script.slice(last, at) });
    const name = match[1] ?? "";
    parts.push({
      variable: name,
      value: scriptValue(name, sample),
      known: isKnown(name),
    });
    last = at + match[0].length;
  }
  if (last < script.length) parts.push({ text: script.slice(last) });
  return parts;
}
