import { z } from "zod";

export interface IntrospectedParam {
  name: string;
  type: string;
  format: string;
  required?: boolean;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

const TRUTHY_STRINGS = ["true", "1", "yes"];
const FALSY_STRINGS = ["false", "0", "no"];

function coerceBooleanString(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const lower = v.toLowerCase();
  if (TRUTHY_STRINGS.includes(lower)) return true;
  if (FALSY_STRINGS.includes(lower)) return false;
  return v;
}

function buildFieldSchema(p: IntrospectedParam): z.ZodTypeAny {
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
  if (p.pattern) s = s.regex(new RegExp(p.pattern));
  return s;
}

/**
 * Build a Zod schema from introspected RPC parameters.
 * - Optional fields tolerate empty strings (coerced to undefined).
 * - Extra row columns pass through unchanged so informational headers and
 *   the importer's own `_duplicateStrategy` sentinel don't trigger failures.
 */
export function buildRowSchema(
  params: IntrospectedParam[],
): z.ZodType<Record<string, unknown>> {
  if (params.length === 0) {
    return z.record(z.string(), z.unknown());
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of params) {
    const inner = buildFieldSchema(p);
    // Always strip empty/null to undefined before running the inner check so
    // `z.coerce.number()` doesn't silently turn "" into 0 on required fields.
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
  // Newline-delimited so UI tooltips can render one error per line.
  return result.error.issues
    .map((i) => {
      const path = i.path.length > 0 ? i.path.join(".") : "row";
      return `${path}: ${i.message}`;
    })
    .join("\n");
}
