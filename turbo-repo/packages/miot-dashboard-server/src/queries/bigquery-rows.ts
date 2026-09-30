import { z } from "zod";
import { upstreamError, validateResult } from "./result";

const resultSchema = z.object({
  jobComplete: z.literal(true),
  pageToken: z.string().optional(),
  totalRows: z.string().max(20).regex(/^\d+$/),
  schema: z.object({
    fields: z
      .array(
        z.object({
          name: z.string().min(1),
          type: z.string(),
          mode: z.string().optional(),
          fields: z.unknown().optional(),
        }),
      )
      .max(100),
  }),
  rows: z
    .array(
      z.object({
        f: z.array(
          z.object({
            v: z.union([
              z.string(),
              z.number().finite(),
              z.boolean(),
              z.null(),
            ]),
          }),
        ),
      }),
    )
    .optional(),
});

/** Reject truncated or nested results rather than silently displaying partial data. */
export function bigQueryRows(body: unknown, maxRows: number, maxBytes: number) {
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) throw upstreamError();
  const { rows = [], schema, totalRows, pageToken } = parsed.data;
  if (
    pageToken ||
    BigInt(totalRows) !== BigInt(rows.length) ||
    rows.length > maxRows
  )
    throw upstreamError();
  const names = schema.fields.map((field) => field.name);
  if (
    new Set(names).size !== names.length ||
    schema.fields.some(
      (field) =>
        field.mode === "REPEATED" ||
        field.fields !== undefined ||
        ["RECORD", "STRUCT"].includes(field.type),
    )
  )
    throw upstreamError();
  return validateResult(
    {
      rows: rows.map(({ f }) => {
        if (f.length !== names.length) throw upstreamError();
        return Object.fromEntries(
          names.map((name, index) => [name, f[index]!.v]),
        );
      }),
    },
    maxRows,
    maxBytes,
  );
}
