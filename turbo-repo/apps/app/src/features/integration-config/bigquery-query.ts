import type { IntegrationConnection } from "./integration-config.types";

/**
 * BigQuery connections and their saved queries.
 *
 * A BigQuery connection is a CUSTOM_HTTP connection to the BigQuery API with a Google
 * service account credential. Each query is a POST operation whose request schema
 * declares the parameters and carries the SQL in `x-dashboard`, which the modulith
 * checks before running it (miot-integrations `BigQueryDashboardPlan`).
 */

export const BIGQUERY_BASE_URL = "https://bigquery.googleapis.com";
/** Not called: the dashboard runs the SQL as BigQuery jobs. Parameter-free by design. */
export const BIGQUERY_OPERATION_PATH = "/bigquery/v2/queries";
/** The modulith refuses more than this by default (`miot.dashboards.bigquery.maximum-bytes-billed`). */
export const MAX_BYTES_BILLED = 1_000_000_000;
export const DEFAULT_BYTES_BILLED = 500_000_000;

export const BIGQUERY_TYPES = [
  "STRING",
  "INT64",
  "FLOAT64",
  "NUMERIC",
  "BOOL",
  "DATE",
  "DATETIME",
  "TIME",
  "TIMESTAMP",
] as const;
export type BigQueryType = (typeof BIGQUERY_TYPES)[number];

export interface BigQueryParameter {
  readonly name: string;
  readonly type: BigQueryType;
}

export interface BigQueryQueryForm {
  readonly name: string;
  readonly projectId: string;
  readonly location: string;
  readonly sql: string;
  readonly maximumBytesBilled: number;
  readonly parameters: readonly BigQueryParameter[];
}

export interface CreateOperationRequest {
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly requestSchema: Record<string, unknown>;
  readonly responseSchema: Record<string, unknown>;
  readonly testOperation: boolean;
}

/** `IntegrationOperation` as miot-integrations serializes it. */
export interface IntegrationOperation {
  readonly id: string;
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly requestSchema: Record<string, unknown>;
}

const PROJECT_ID = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const LOCATION = /^[A-Za-z0-9-]{2,64}$/;
const PARAMETER_NAME = /^[A-Za-z_]\w{0,127}$/;

export function isBigQueryConnection(
  connection: Pick<IntegrationConnection, "baseUrl" | "templateId">
): boolean {
  return (
    connection.templateId === null &&
    connection.baseUrl.replace(/\/$/, "") === BIGQUERY_BASE_URL
  );
}

/** The first problem with a query form, as a dictionary key, or null when it can be saved. */
export function bigQueryFormError(form: BigQueryQueryForm): string | null {
  if (!form.name.trim()) return "bigquery.errors.name";
  if (!PROJECT_ID.test(form.projectId)) return "bigquery.errors.project";
  if (!LOCATION.test(form.location)) return "bigquery.errors.location";
  if (!form.sql.trim()) return "bigquery.errors.sql";
  if (
    !Number.isInteger(form.maximumBytesBilled) ||
    form.maximumBytesBilled < 1 ||
    form.maximumBytesBilled > MAX_BYTES_BILLED
  ) {
    return "bigquery.errors.bytes";
  }
  const names = form.parameters.map((parameter) => parameter.name);
  if (names.some((name) => !PARAMETER_NAME.test(name))) {
    return "bigquery.errors.parameterName";
  }
  if (new Set(names).size !== names.length) {
    return "bigquery.errors.parameterDuplicate";
  }
  return null;
}

function propertyFor(type: BigQueryType): Record<string, unknown> {
  switch (type) {
    case "INT64":
      return { type: "integer" };
    case "FLOAT64":
    case "NUMERIC":
      return { type: "number" };
    case "BOOL":
      return { type: "boolean" };
    case "DATE":
      return { type: "string", format: "date" };
    default:
      return { type: "string" };
  }
}

/**
 * The operation the modulith stores for a query. Every parameter is required: the
 * modulith runs a query only when each declared parameter has a value.
 */
export function buildBigQueryOperation(
  form: BigQueryQueryForm
): CreateOperationRequest {
  const parameters = form.parameters.map((parameter) => ({
    ...parameter,
    name: parameter.name.trim(),
  }));
  return {
    name: form.name.trim(),
    method: "POST",
    path: BIGQUERY_OPERATION_PATH,
    requestSchema: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        parameters.map((parameter) => [
          parameter.name,
          propertyFor(parameter.type),
        ])
      ),
      required: parameters.map((parameter) => parameter.name),
      "x-dashboard": {
        readOnly: true,
        kind: "BIGQUERY",
        credentialScoped: true,
        projectId: form.projectId.trim(),
        location: form.location.trim(),
        query: form.sql.trim(),
        maximumBytesBilled: String(form.maximumBytesBilled),
        parameterTypes: Object.fromEntries(
          parameters.map((parameter) => [parameter.name, parameter.type])
        ),
      },
    },
    responseSchema: {},
    testOperation: false,
  };
}

export interface BigQueryQuerySummary {
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly location: string;
  readonly sql: string;
  readonly parameters: readonly string[];
}

/** The saved queries among a connection's operations; anything else is left out. */
export function bigQueryQueries(
  operations: readonly IntegrationOperation[]
): BigQueryQuerySummary[] {
  return operations.flatMap((operation) => {
    const settings = operation.requestSchema["x-dashboard"];
    if (typeof settings !== "object" || settings === null) return [];
    const dashboard = settings as Record<string, unknown>;
    if (dashboard.kind !== "BIGQUERY") return [];
    const types = dashboard.parameterTypes;
    return [
      {
        id: operation.id,
        name: operation.name,
        projectId: String(dashboard.projectId ?? ""),
        location: String(dashboard.location ?? ""),
        sql: String(dashboard.query ?? ""),
        parameters:
          typeof types === "object" && types !== null
            ? Object.entries(types).map(([name, type]) => `${name}: ${type}`)
            : [],
      },
    ];
  });
}
