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
    sql: z.string().trim().min(1).max(65_536),
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

/** `@name` references in the SQL, outside strings, identifiers and comments. */
export function sqlParameterNames(sql: string): string[] {
  const names = new Set<string>();
  const token =
    /--[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`[^`]*`|@@?([A-Za-z_]\w*)/g;
  for (const match of sql.matchAll(token)) {
    if (match[1] && !match[0].startsWith("@@")) names.add(match[1]);
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
