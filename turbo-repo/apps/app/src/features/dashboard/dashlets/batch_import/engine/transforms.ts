/** Per-column value transforms applied between parse and validate. Steps run
 *  in array order; non-numeric input flowing through a numeric step is passed
 *  through unchanged so the validator (not the transform) surfaces the type
 *  mismatch as a clear "Expected number, received nan" error. */
export type TransformKind =
  | "trim"
  | "upper"
  | "lower"
  | "abs"
  | "round"
  | "fixed";

export interface TransformStep {
  kind: TransformKind;
  /** Optional argument for parameterized transforms (e.g., decimals for `fixed`). */
  arg?: string;
}

export type TransformScope = "string" | "number";

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
};

export function transformsForType(type: string | undefined): TransformKind[] {
  const wanted: TransformScope =
    type === "number" || type === "integer" ? "number" : "string";
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
