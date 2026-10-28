/**
 * Writing, testing and saving SQL queries against a query source. A saved
 * query becomes an operation of its source's catalog, so a dashboard refers to
 * it through `DashboardQueryDefinition` like any other operation.
 */

import { z } from "zod/v3";
import type { DashboardQueryValue } from "./document";

export const QUERY_SOURCE_KINDS = ["BIGQUERY"] as const;
export type QuerySourceKind = (typeof QUERY_SOURCE_KINDS)[number];

/** A connection that queries can be written against. */
export interface QuerySource {
  id: string;
  label: string;
  kind: QuerySourceKind;
  /** The project of the source's credential. */
  defaultProjectId: string;
  defaultLocation?: string;
}

export const QUERY_PARAMETER_TYPES = [
  "STRING",
  "INT64",
  "FLOAT64",
  "NUMERIC",
  "BIGNUMERIC",
  "BOOL",
  "DATE",
  "DATETIME",
  "TIME",
  "TIMESTAMP",
] as const;
export type QueryParameterType = (typeof QUERY_PARAMETER_TYPES)[number];

export interface QueryPlanParameter {
  /** Referenced as `@name` in the SQL. */
  name: string;
  type: QueryParameterType;
  /** Value used to test the query in the editor. Dashboards never use it. */
  sample?: string | null;
}

/** What the author edits. */
export interface QueryPlanDraft {
  /** Unique per source, ignoring case. */
  name: string;
  description?: string;
  projectId: string;
  location: string;
  sql: string;
  maximumBytesBilled: number;
  parameters: QueryPlanParameter[];
}

export interface QueryColumn {
  name: string;
  /** The BigQuery type as reported: STRING, FLOAT64, RECORD… */
  type: string;
  mode?: "NULLABLE" | "REQUIRED" | "REPEATED";
  /** Only in a source schema. */
  fields?: QueryColumn[];
}

/** A saved query. */
export interface QueryPlan extends QueryPlanDraft {
  id: string;
  sourceId: string;
  /** Columns of the last successful estimate. */
  columns?: QueryColumn[];
  /** Changes on every save; sent back as If-Match. */
  revision: string;
  updatedAt: string;
  updatedBy?: string;
}

export type SourceTableType =
  | "TABLE"
  | "VIEW"
  | "EXTERNAL"
  | "MATERIALIZED_VIEW"
  | "SNAPSHOT"
  | "CLONE";

export interface SourceTable {
  name: string;
  type: SourceTableType;
  columns: QueryColumn[];
}

export interface SourceDataset {
  name: string;
  location: string;
  tables: SourceTable[];
}

export interface SourceSchema {
  projectId: string;
  datasets: SourceDataset[];
  /** There were more tables or columns than returned. */
  truncated: boolean;
}

/** A BigQuery error shown to the author. Never carries credential data. */
export interface QueryProblem {
  message: string;
  line?: number;
  column?: number;
}

export interface QueryEstimate {
  ok: boolean;
  /** Only SELECT can be saved and previewed. */
  statementType?: string;
  totalBytesProcessed?: number;
  columns?: QueryColumn[];
  problem?: QueryProblem;
}

export interface QueryPreview {
  ok: boolean;
  columns: QueryColumn[];
  rows: Record<string, DashboardQueryValue>[];
  totalRows: number;
  /** More rows than the dashboard limit; `rows` holds the first ones. */
  truncated: boolean;
  totalBytesProcessed: number;
  cacheHit: boolean;
  durationMs: number;
  /** Why a dashboard would refuse this result, although the preview shows it. */
  warnings: string[];
  problem?: QueryProblem;
}

export const queryPlanParameterSchema = z
  .object({
    name: z.string().regex(/^[A-Za-z_]\w{0,127}$/),
    type: z.enum(QUERY_PARAMETER_TYPES),
    sample: z.string().max(4096).nullable().optional(),
  })
  .strict();

export const queryPlanDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(128),
    description: z.string().max(1024).optional(),
    projectId: z.string().regex(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/),
    location: z.string().regex(/^[A-Za-z0-9-]{2,64}$/),
    sql: z
      .string()
      .min(1)
      .max(65_536)
      .refine((sql) => sql.trim().length > 0, "SQL must not be blank"),
    maximumBytesBilled: z.number().int().positive().safe(),
    parameters: z
      .array(queryPlanParameterSchema)
      .max(100)
      .refine(
        (parameters) =>
          new Set(parameters.map((parameter) => parameter.name.toLowerCase()))
            .size === parameters.length,
        "Parameter names must be unique",
      ),
  })
  .strict();

/** Runtime validation of authoring responses from servers and host adapters. */
export const queryColumnSchema: z.ZodType<QueryColumn> = z.lazy(() =>
  z.object({
    name: z.string(),
    type: z.string(),
    mode: z.enum(["NULLABLE", "REQUIRED", "REPEATED"]).optional(),
    fields: z.array(queryColumnSchema).optional(),
  }),
);
export const querySourceSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(QUERY_SOURCE_KINDS),
  defaultProjectId: z.string(),
  defaultLocation: z.string().optional(),
});
export const querySourcesSchema = z.array(querySourceSchema);
export const queryPlanSchema = queryPlanDraftSchema.extend({
  id: z.string(),
  sourceId: z.string(),
  columns: z.array(queryColumnSchema).optional(),
  revision: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().optional(),
});
export const queryPlansSchema = z.array(queryPlanSchema);
export const sourceSchema = z.object({
  projectId: z.string(),
  truncated: z.boolean(),
  datasets: z.array(
    z.object({
      name: z.string(),
      location: z.string(),
      tables: z.array(
        z.object({
          name: z.string(),
          type: z.enum([
            "TABLE",
            "VIEW",
            "EXTERNAL",
            "MATERIALIZED_VIEW",
            "SNAPSHOT",
            "CLONE",
          ]),
          columns: z.array(queryColumnSchema),
        }),
      ),
    }),
  ),
});
const queryProblemSchema = z.object({
  message: z.string(),
  line: z.number().int().optional(),
  column: z.number().int().optional(),
});
export const queryEstimateSchema = z.object({
  ok: z.boolean(),
  statementType: z.string().optional(),
  totalBytesProcessed: z.number().optional(),
  columns: z.array(queryColumnSchema).optional(),
  problem: queryProblemSchema.optional(),
});
const responseScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const queryPreviewSchema = z.object({
  ok: z.boolean(),
  columns: z.array(queryColumnSchema),
  rows: z.array(z.record(z.union([responseScalar, z.array(responseScalar)]))),
  totalRows: z.number(),
  truncated: z.boolean(),
  totalBytesProcessed: z.number(),
  cacheHit: z.boolean(),
  durationMs: z.number(),
  warnings: z.array(z.string()),
  problem: queryProblemSchema.optional(),
});

function quotedEnd(sql: string, start: number): number | null {
  const character = sql[start];
  if (!character || !["'", '"', "`"].includes(character)) return null;
  const delimiter =
    character !== "`" && sql.startsWith(character.repeat(3), start)
      ? character.repeat(3)
      : character;
  let index = start + delimiter.length;
  while (index < sql.length) {
    if (sql[index] === "\\") index += 2;
    else if (sql.startsWith(delimiter, index)) return index + delimiter.length;
    else index++;
  }
  return sql.length;
}

function ignoredTokenEnd(sql: string, start: number): number | null {
  if (sql[start] === "#" || sql.startsWith("--", start)) {
    const newline = sql.slice(start).search(/[\r\n]/);
    return newline < 0 ? sql.length : start + newline + 1;
  }
  if (sql.startsWith("/*", start)) {
    const end = sql.indexOf("*/", start + 2);
    return end < 0 ? sql.length : end + 2;
  }
  return quotedEnd(sql, start);
}

/** `@name` references outside GoogleSQL strings, identifiers and comments. */
export function sqlParameterNames(sql: string): string[] {
  const names = new Set<string>();
  let index = 0;
  while (index < sql.length) {
    const ignoredEnd = ignoredTokenEnd(sql, index);
    if (ignoredEnd !== null) {
      index = ignoredEnd;
      continue;
    }
    const parameter =
      sql[index] === "@" ? /^@@?([A-Za-z_]\w*)/.exec(sql.slice(index)) : null;
    if (parameter) {
      if (!parameter[0].startsWith("@@")) names.add(parameter[1]!);
      index += parameter[0].length;
    } else index++;
  }
  return [...names];
}

/** `[line:column]` from a BigQuery error message, 1-based. */
export function problemFromMessage(message: string): QueryProblem {
  const position = /\[(\d+):(\d+)\]/.exec(message);
  return position
    ? {
        message,
        line: Number(position[1]),
        column: Number(position[2]),
      }
    : { message };
}
