/** Script variables the treatment screen fills from the case. */
export const SCRIPT_VARIABLES = [
  "patente",
  "conductor",
  "velocidad",
  "limite",
  "ruta",
] as const;

/** The sample fields each variable is read from, first match wins. */
const SOURCES: Record<string, string[]> = {
  patente: ["plate"],
  conductor: ["driver_name", "driver"],
  velocidad: ["speed_kmh"],
  limite: ["maxspeed_osm", "speed_limit"],
  ruta: ["route"],
};

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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

function valueOf(name: string, sample: Json | undefined): string | null {
  if (!sample) return null;
  for (const key of SOURCES[name] ?? []) {
    const v = find(sample, key);
    if (typeof v === "string" || typeof v === "number") return String(v);
  }
  return null;
}

/** A piece of a script: plain text, or a variable with the sample's value (null when the sample lacks it). */
export type ScriptPart =
  | { text: string }
  | { variable: string; value: string | null };

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
    parts.push({ variable: name, value: valueOf(name, sample) });
    last = at + match[0].length;
  }
  if (last < script.length) parts.push({ text: script.slice(last) });
  return parts;
}
