import { ruleKey } from "../condition-form";

/*
 * Marks for what the draft changes against the published version, in violet:
 * amber is Harness and warnings, red errors, blue actions and focus.
 */

/** A field whose value differs from the published version. */
export const CHANGED =
  "!border-violet-400 !bg-violet-50 dark:!border-violet-500 dark:!bg-violet-500/15";

/** A section card that differs. */
export const CHANGED_CARD = "!border-violet-300 dark:!border-violet-600/60";

/** A full-width row that differs: a tint and a bar on its left edge. */
export const CHANGED_ROW =
  "bg-violet-50/70 shadow-[inset_3px_0_0] shadow-violet-400 dark:bg-violet-500/10 dark:shadow-violet-500";

/** The bar of unpublished changes at the bottom of the sheet. */
export const CHANGED_BAR = "border-violet-300 dark:border-violet-600/60";
export const CHANGED_DOT = "bg-violet-400";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** The spec fields that hold CEL; two writings of one rule there are no change. */
const RULE_PATH =
  /^(activation|measure\.expression|lifecycle\.(open|close)|levels\.\d+\.when)$/;

const join = (path: string, key: string | number) =>
  path ? `${path}.${key}` : String(key);

/** Missing, null, false and [] are one value: the editor writes defaults an older version lacks. */
const unset = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === false ||
  (Array.isArray(v) && v.length === 0);

/** Adds to `out` every path under which `a` and `b` differ. */
function walk(a: unknown, b: unknown, path: string, out: Set<string>) {
  if (a === b || (unset(a) && unset(b))) return;
  if (
    typeof a === "string" &&
    typeof b === "string" &&
    RULE_PATH.test(path) &&
    ruleKey(a) === ruleKey(b)
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
 * null value count as equal, and so do two writings of one CEL rule.
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
