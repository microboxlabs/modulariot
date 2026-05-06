import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

/** Per-column value transforms applied between parse and validate. Steps run
 *  in array order; non-numeric input flowing through a numeric step is passed
 *  through unchanged so the validator (not the transform) surfaces the type
 *  mismatch as a clear "Expected number, received nan" error. The same
 *  pass-through rule applies to date steps fed an unparseable value. */
export type TransformKind =
  | "trim"
  | "upper"
  | "lower"
  | "abs"
  | "round"
  | "fixed"
  | "dateOnly"
  | "startOfDay"
  | "toUTC";

export interface TransformStep {
  kind: TransformKind;
  /** Optional argument for parameterized transforms (e.g., decimals for `fixed`). */
  arg?: string;
}

export type TransformScope = "string" | "number" | "date";

interface TransformMeta {
  scope: TransformScope;
  takesArg: boolean;
}

export const TRANSFORM_REGISTRY: Record<TransformKind, TransformMeta> = {
  trim: { scope: "string", takesArg: false },
  upper: { scope: "string", takesArg: false },
  lower: { scope: "string", takesArg: false },
  abs: { scope: "number", takesArg: false },
  round: { scope: "number", takesArg: false },
  fixed: { scope: "number", takesArg: true },
  dateOnly: { scope: "date", takesArg: false },
  startOfDay: { scope: "date", takesArg: false },
  toUTC: { scope: "date", takesArg: false },
};

export function transformsForType(
  type: string | undefined,
  format?: string,
): TransformKind[] {
  let wanted: TransformScope;
  if (format === "date" || format === "date-time") {
    wanted = "date";
  } else if (type === "number" || type === "integer") {
    wanted = "number";
  } else {
    wanted = "string";
  }
  return (Object.keys(TRANSFORM_REGISTRY) as TransformKind[]).filter(
    (k) => TRANSFORM_REGISTRY[k].scope === wanted,
  );
}

function applyOne(value: string, step: TransformStep): string {
  switch (step.kind) {
    case "trim":
      return value.trim();
    case "upper":
      return value.toUpperCase();
    case "lower":
      return value.toLowerCase();
    case "abs": {
      const n = Number(value);
      return Number.isFinite(n) ? String(Math.abs(n)) : value;
    }
    case "round": {
      const n = Number(value);
      return Number.isFinite(n) ? String(Math.round(n)) : value;
    }
    case "fixed": {
      const n = Number(value);
      if (!Number.isFinite(n)) return value;
      const raw = Number(step.arg);
      const dec = Number.isFinite(raw) ? Math.max(0, Math.min(20, Math.trunc(raw))) : 2;
      return n.toFixed(dec);
    }
    case "dateOnly": {
      const d = dayjs(value);
      return d.isValid() ? d.format("YYYY-MM-DD") : value;
    }
    case "startOfDay": {
      const d = dayjs(value);
      return d.isValid() ? d.startOf("day").toISOString() : value;
    }
    case "toUTC": {
      const d = dayjs(value);
      return d.isValid() ? d.utc().toISOString() : value;
    }
    default:
      return value;
  }
}

export function applyTransforms(
  value: string,
  steps: readonly TransformStep[] | undefined,
): string {
  if (!steps || steps.length === 0) return value;
  let v = value;
  for (const s of steps) v = applyOne(v, s);
  return v;
}
