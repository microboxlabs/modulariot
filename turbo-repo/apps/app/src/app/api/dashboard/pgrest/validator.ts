import { z } from "zod";
import type { IntrospectedParameter } from "./shared";

const TRUTHY_STRINGS = new Set(["true", "1", "yes"]);
const FALSY_STRINGS = new Set(["false", "0", "no"]);

function coerceBooleanString(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const lower = v.toLowerCase();
  if (TRUTHY_STRINGS.has(lower)) return true;
  if (FALSY_STRINGS.has(lower)) return false;
  return v;
}

function buildFieldSchema(p: IntrospectedParameter): z.ZodTypeAny {
  if (p.enum && p.enum.length > 0) {
    return z.enum(p.enum as [string, ...string[]]);
  }

  if (p.type === "integer" || p.type === "number") {
    let s: z.ZodNumber = z.coerce.number();
    if (p.type === "integer") s = s.int();
    if (typeof p.minimum === "number") s = s.min(p.minimum);
    if (typeof p.maximum === "number") s = s.max(p.maximum);
    return s;
  }

  if (p.type === "boolean") {
    return z.preprocess(coerceBooleanString, z.boolean());
  }

  let s: z.ZodString = z.string();
  if (p.format === "date-time") s = s.datetime({ offset: true });
  if (p.pattern) {
    // Upstream PostgREST may expose a CHECK-constraint regex that isn't valid
    // JS syntax (e.g. POSIX classes). Fall through without the pattern check
    // rather than crashing the whole schema builder.
    try {
      s = s.regex(new RegExp(p.pattern));
    } catch (err) {
      // `p.name` comes from RPC introspection and could contain console
      // format specifiers — pass it as a separate arg, not interpolated.
      console.warn(
        "pgrest/validator: skipping invalid regex for parameter",
        p.name,
        err,
      );
    }
  }
  return s;
}

export function buildRowSchema(
  params: IntrospectedParameter[],
): z.ZodType<Record<string, unknown>> {
  if (params.length === 0) {
    return z.record(z.string(), z.unknown());
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    const inner = buildFieldSchema(p);
    shape[p.name] = z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? undefined : v),
      p.required ? inner : inner.optional(),
    );
  }
  return z.object(shape).passthrough();
}

export function validateRow(
  fields: Record<string, string>,
  schema: z.ZodType<Record<string, unknown>>,
): string | null {
  const result = schema.safeParse(fields);
  if (result.success) return null;
  return result.error.issues
    .map((i) => {
      const path = i.path.length > 0 ? i.path.join(".") : "row";
      return `${path}: ${i.message}`;
    })
    .join("\n");
}

/**
 * Validate a batch of rows against an introspected schema. Returns a map of
 * row index → newline-delimited error message for rows that failed validation.
 * Rows that pass validation are absent from the returned map.
 */
export function validateRows(
  rows: { index: number; fields: Record<string, string> }[],
  params: IntrospectedParameter[],
): Record<number, string> {
  const out: Record<number, string> = {};
  if (params.length === 0 || rows.length === 0) return out;
  const schema = buildRowSchema(params);
  for (const row of rows) {
    const err = validateRow(row.fields, schema);
    if (err) out[row.index] = err;
  }
  return out;
}
