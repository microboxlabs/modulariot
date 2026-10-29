import type {
  QueryColumn,
  QueryPreview,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import type { DashboardQueryValue } from "@microboxlabs/miot-dashboard-contract/document";
import { z } from "zod/v3";
import { BigQueryProblem } from "../queries/bigquery";

interface Field {
  name: string;
  type: string;
  mode?: string;
  fields?: Field[];
}

const fieldSchema: z.ZodType<Field> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.string(),
    mode: z.string().optional(),
    fields: z.array(fieldSchema).optional(),
  }),
);

const resultSchema = z.object({
  totalRows: z.string().regex(/^\d+$/).optional(),
  pageToken: z.string().optional(),
  totalBytesProcessed: z.string().regex(/^\d+$/).optional(),
  cacheHit: z.boolean().optional(),
  schema: z.object({ fields: z.array(fieldSchema) }).optional(),
  rows: z
    .array(z.object({ f: z.array(z.object({ v: z.unknown() })) }))
    .optional(),
});

const MODES = new Set(["NULLABLE", "REQUIRED", "REPEATED"]);

function column(field: Field): QueryColumn {
  return {
    name: field.name,
    type: field.type,
    ...(field.mode && MODES.has(field.mode)
      ? { mode: field.mode as QueryColumn["mode"] }
      : {}),
    ...(field.fields ? { fields: field.fields.map(column) } : {}),
  };
}

/** Columns from BigQuery's `schema.fields`; unreadable input gives none. */
export function columnsOf(fields: unknown): QueryColumn[] {
  const parsed = z.array(fieldSchema).safeParse(fields);
  return parsed.success ? parsed.data.map(column) : [];
}

const nested = (field: Field) =>
  field.mode === "REPEATED" ||
  field.fields !== undefined ||
  field.type === "RECORD" ||
  field.type === "STRUCT";

/** A record or repeated cell as plain JSON: objects for records, lists for repeated. */
function plain(field: Field, cell: unknown): unknown {
  if (cell === null || cell === undefined) return null;
  if (field.mode === "REPEATED" && Array.isArray(cell)) {
    const item = { ...field, mode: "NULLABLE" };
    return cell.map((entry) => plain(item, (entry as { v?: unknown }).v));
  }
  if (field.fields && typeof cell === "object" && "f" in cell) {
    const values = (cell as { f: { v?: unknown }[] }).f;
    return Object.fromEntries(
      field.fields.map((child, index) => [
        child.name,
        plain(child, values[index]?.v),
      ]),
    );
  }
  return cell;
}

function cellValue(field: Field, cell: unknown): DashboardQueryValue {
  if (nested(field)) return JSON.stringify(plain(field, cell));
  if (
    cell === null ||
    typeof cell === "string" ||
    typeof cell === "number" ||
    typeof cell === "boolean"
  )
    return cell;
  return JSON.stringify(cell);
}

/**
 * The rows of a finished query for the editor. Results a dashboard refuses
 * (nested columns, too many rows) are still shown, with a warning saying why.
 */
export function previewOf(
  body: unknown,
  maxRows: number,
  durationMs: number,
): QueryPreview {
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) throw new BigQueryProblem("Unexpected BigQuery answer");
  const fields = parsed.data.schema?.fields ?? [];
  const received = parsed.data.rows ?? [];
  const totalRows = Number(parsed.data.totalRows ?? received.length);
  const truncated =
    received.length > maxRows ||
    totalRows > received.length ||
    parsed.data.pageToken !== undefined;
  const warnings: string[] = [];
  const nestedNames = fields.filter(nested).map((field) => field.name);
  if (nestedNames.length)
    warnings.push(
      `A dashboard refuses nested or repeated columns: ${nestedNames.join(", ")}`,
    );
  if (truncated)
    warnings.push(
      `A dashboard refuses results of more than ${maxRows} rows; this one has ${totalRows}`,
    );
  const names = fields.map((field) => field.name);
  if (new Set(names).size !== names.length)
    warnings.push("A dashboard refuses two columns with the same name");
  return {
    ok: true,
    columns: fields.map(column),
    rows: received
      .slice(0, maxRows)
      .map(({ f }) =>
        Object.fromEntries(
          fields.map((field, index) => [
            field.name,
            cellValue(field, f[index]?.v),
          ]),
        ),
      ),
    totalRows,
    truncated,
    totalBytesProcessed: Number(parsed.data.totalBytesProcessed ?? 0),
    cacheHit: parsed.data.cacheHit ?? false,
    durationMs,
    warnings,
  };
}
