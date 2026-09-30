/** Amber mark on a field whose value differs from the published version. */
export const CHANGED =
  "!border-amber-400 !bg-amber-50 dark:!border-amber-500 dark:!bg-amber-500/15";

type Json = unknown;

function isObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Dotted paths whose value differs between `draft` and `published`, with array
 * indexes as path segments: `levels.3.response.slaMinutes`. A missing and a
 * null value count as equal.
 */
export function changedPaths(draft: Json, published: Json): Set<string> {
  const out = new Set<string>();
  const walk = (a: Json, b: Json, path: string) => {
    if ((a ?? null) === (b ?? null)) return;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) out.add(path);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        walk(a[i], b[i], path ? `${path}.${i}` : String(i));
      }
      return;
    }
    if (isObject(a) && isObject(b)) {
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        walk(a[k], b[k], path ? `${path}.${k}` : k);
      }
      return;
    }
    out.add(path);
  };
  walk(draft, published, "");
  return out;
}

/** Whether `path` or anything under it changed. */
export function isChanged(paths: ReadonlySet<string>, path: string) {
  if (paths.has(path)) return true;
  const prefix = `${path}.`;
  for (const p of paths) if (p.startsWith(prefix)) return true;
  return false;
}
