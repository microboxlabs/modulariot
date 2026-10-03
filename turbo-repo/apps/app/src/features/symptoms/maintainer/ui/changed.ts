import { squashSpaces } from "../condition-form";

/** Amber mark on a field whose value differs from the published version. */
export const CHANGED =
  "!border-amber-400 !bg-amber-50 dark:!border-amber-500 dark:!bg-amber-500/15";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const join = (path: string, key: string | number) =>
  path ? `${path}.${key}` : String(key);

/** Adds to `out` every path under which `a` and `b` differ. */
function walk(a: unknown, b: unknown, path: string, out: Set<string>) {
  if ((a ?? null) === (b ?? null)) return;
  if (
    typeof a === "string" &&
    typeof b === "string" &&
    squashSpaces(a) === squashSpaces(b)
  )
    return;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) out.add(path);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      walk(a[i], b[i], join(path, i), out);
    }
    return;
  }
  if (isObject(a) && isObject(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      walk(a[k], b[k], join(path, k), out);
    }
    return;
  }
  out.add(path);
}

/**
 * Dotted paths whose value differs between `draft` and `published`, with array
 * indexes as path segments: `levels.3.response.slaMinutes`. A missing and a
 * null value count as equal, and so do two texts that differ only in whitespace
 * outside quotes, as two writings of one rule do.
 */
export function changedPaths(draft: unknown, published: unknown): Set<string> {
  const out = new Set<string>();
  walk(draft, published, "", out);
  return out;
}

/** Whether `path` or anything under it changed. */
export function isChanged(paths: ReadonlySet<string>, path: string) {
  if (paths.has(path)) return true;
  const prefix = `${path}.`;
  for (const p of paths) if (p.startsWith(prefix)) return true;
  return false;
}
