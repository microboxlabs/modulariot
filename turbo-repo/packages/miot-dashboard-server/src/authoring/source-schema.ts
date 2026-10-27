import type {
  QueryColumn,
  SourceDataset,
  SourceSchema,
  SourceTable,
  SourceTableType,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { z } from "zod/v3";
import { BigQueryProblem } from "../queries/bigquery";

/** Field paths read per location before the schema is marked truncated. */
export const MAX_FIELD_PATHS = 20_000;
const MAX_DATASETS = 1000;
const LOCATION = /^[A-Za-z0-9-]{2,64}$/;

type Call = (
  url: string,
  token: string,
  signal: AbortSignal,
  maxBytes: number,
  body?: object,
) => Promise<Record<string, unknown>>;

export interface SourceSchemaRequest {
  projectId: string;
  token: string;
  signal: AbortSignal;
  maximumBytesBilled: number;
  call: Call;
}

const datasetsSchema = z.object({
  nextPageToken: z.string().optional(),
  datasets: z
    .array(
      z.object({
        datasetReference: z.object({ datasetId: z.string() }),
        location: z.string(),
      }),
    )
    .optional(),
});

const rowsSchema = z.object({
  jobComplete: z.boolean().optional(),
  pageToken: z.string().optional(),
  rows: z
    .array(
      z.object({
        f: z.array(z.object({ v: z.string().nullable() })).length(5),
      }),
    )
    .optional(),
});

const TABLE_TYPES: Record<string, SourceTableType> = {
  "BASE TABLE": "TABLE",
  VIEW: "VIEW",
  EXTERNAL: "EXTERNAL",
  "MATERIALIZED VIEW": "MATERIALIZED_VIEW",
  SNAPSHOT: "SNAPSHOT",
  CLONE: "CLONE",
};

/** `ARRAY<INT64>` is a repeated INT64; `STRUCT<…>` a record. */
function columnOf(name: string, dataType: string): QueryColumn {
  const repeated = dataType.startsWith("ARRAY<") && dataType.endsWith(">");
  const inner = repeated ? dataType.slice(6, -1) : dataType;
  const type = inner.startsWith("STRUCT<") ? "STRUCT" : inner;
  return repeated ? { name, type, mode: "REPEATED" } : { name, type };
}

function sql(projectId: string, location: string) {
  const region = `\`${projectId}\`.\`region-${location.toLowerCase()}\`.INFORMATION_SCHEMA`;
  return [
    "SELECT c.table_schema, c.table_name, t.table_type, p.field_path, p.data_type",
    `FROM ${region}.COLUMN_FIELD_PATHS AS p`,
    `JOIN ${region}.COLUMNS AS c USING (table_schema, table_name, column_name)`,
    `JOIN ${region}.TABLES AS t USING (table_schema, table_name)`,
    "ORDER BY c.table_schema, c.table_name, c.ordinal_position, p.field_path",
    `LIMIT ${MAX_FIELD_PATHS + 1}`,
  ].join("\n");
}

/**
 * Datasets, tables and columns of a project, with nested fields. One
 * INFORMATION_SCHEMA query per dataset location; BigQuery bills each the
 * 10 MB minimum of a metadata query.
 */
export async function readSourceSchema(
  request: SourceSchemaRequest,
): Promise<SourceSchema> {
  const { projectId, token, call } = request;
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]);
  const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}`;
  const listing = datasetsSchema.safeParse(
    await call(
      `${base}/datasets?maxResults=${MAX_DATASETS}`,
      token,
      signal,
      2 * 1024 * 1024,
    ),
  );
  if (!listing.success) throw new BigQueryProblem("Unexpected BigQuery answer");
  let truncated = listing.data.nextPageToken !== undefined;
  const datasets = new Map<string, SourceDataset>();
  for (const entry of listing.data.datasets ?? []) {
    datasets.set(entry.datasetReference.datasetId, {
      name: entry.datasetReference.datasetId,
      location: entry.location,
      tables: [],
    });
  }
  const locations = [
    ...new Set([...datasets.values()].map((dataset) => dataset.location)),
  ].filter((location) => LOCATION.test(location));

  for (const location of locations) {
    const answer = rowsSchema.safeParse(
      await call(`${base}/queries`, token, signal, 16 * 1024 * 1024, {
        query: sql(projectId, location),
        useLegacySql: false,
        location,
        maxResults: MAX_FIELD_PATHS + 1,
        timeoutMs: 15_000,
        maximumBytesBilled: String(request.maximumBytesBilled),
      }),
    );
    if (!answer.success)
      throw new BigQueryProblem("Unexpected BigQuery answer");
    if (answer.data.jobComplete === false) {
      truncated = true;
      continue;
    }
    const rows = answer.data.rows ?? [];
    if (rows.length > MAX_FIELD_PATHS || answer.data.pageToken)
      truncated = true;
    const tables = new Map<string, SourceTable>();
    for (const { f } of rows.slice(0, MAX_FIELD_PATHS)) {
      const [datasetName, tableName, tableType, path, dataType] = f.map(
        (cell) => cell.v ?? "",
      ) as [string, string, string, string, string];
      const dataset = datasets.get(datasetName);
      if (!dataset) continue;
      const key = `${datasetName}.${tableName}`;
      let table = tables.get(key);
      if (!table) {
        table = {
          name: tableName,
          type: TABLE_TYPES[tableType] ?? "TABLE",
          columns: [],
        };
        tables.set(key, table);
        dataset.tables.push(table);
      }
      const parts = path.split(".");
      let siblings = table.columns;
      for (const part of parts.slice(0, -1)) {
        const parent = siblings.find((candidate) => candidate.name === part);
        if (!parent) break;
        parent.fields ??= [];
        siblings = parent.fields;
      }
      siblings.push(columnOf(parts.at(-1) ?? path, dataType));
    }
  }
  return { projectId, datasets: [...datasets.values()], truncated };
}
