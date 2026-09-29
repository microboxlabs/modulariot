import { z } from "zod";
import { dashboardQueryValueSchema } from "@microboxlabs/miot-dashboard-contract/schema";
import type { DashboardQueryValue } from "@microboxlabs/miot-dashboard-contract/document";
import { upstreamError } from "./result";

const scalarTypes: readonly string[] = [
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
];
const planSchema = z
  .object({
    projectId: z.string().regex(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/),
    location: z.string().regex(/^[A-Za-z0-9-]{2,64}$/),
    sql: z.string().trim().min(1).max(65_536),
    maximumBytesBilled: z.number().int().positive().safe(),
    parameterTypes: z.record(
      z.string().regex(/^[A-Za-z_]\w{0,127}$/),
      z.string(),
    ),
  })
  .strict();

/** Trusted operator-owned template, never accepted from a dashboard query body. */
export type BigQueryPlan = z.infer<typeof planSchema>;

function parameter(name: string, type: string, value: DashboardQueryValue) {
  const array = type.startsWith("ARRAY<") && type.endsWith(">");
  const scalarType = array ? type.slice(6, -1) : type;
  if (
    !scalarTypes.includes(scalarType) ||
    array !== Array.isArray(value)
  )
    throw upstreamError();
  const scalar = (item: Exclude<DashboardQueryValue, unknown[]>) => ({
    value: item === null ? null : String(item),
  });
  return {
    name,
    parameterType: array
      ? { type: "ARRAY", arrayType: { type: scalarType } }
      : { type: scalarType },
    parameterValue: Array.isArray(value)
      ? { arrayValues: value.map(scalar) }
      : scalar(value),
  };
}

export function prepareBigQuery(
  plan: BigQueryPlan,
  values: Record<string, DashboardQueryValue>,
  hostByteCap: number,
) {
  const parsed = planSchema.safeParse(plan);
  if (
    !parsed.success ||
    !Number.isSafeInteger(hostByteCap) ||
    hostByteCap < 1 ||
    parsed.data.maximumBytesBilled > hostByteCap
  )
    throw upstreamError();
  const config = parsed.data;
  const entries = Object.entries(values);
  if (
    entries.length > 100 ||
    entries.length !== Object.keys(config.parameterTypes).length
  )
    throw upstreamError();
  const queryParameters = entries.map(([name, value]) => {
    if (
      !Object.hasOwn(config.parameterTypes, name) ||
      !dashboardQueryValueSchema.safeParse(value).success
    )
      throw upstreamError();
    return parameter(name, config.parameterTypes[name]!, value);
  });
  const query = {
    query: config.sql,
    useLegacySql: false,
    useQueryCache: true,
    maximumBytesBilled: String(config.maximumBytesBilled),
    parameterMode: "NAMED",
    queryParameters,
  };
  return {
    projectId: config.projectId,
    location: config.location,
    maximumBytesBilled: config.maximumBytesBilled,
    job(jobId: string | undefined, timeoutMs: number) {
      return {
        jobReference: {
          projectId: config.projectId,
          location: config.location,
          ...(jobId ? { jobId } : {}),
        },
        configuration: {
          dryRun: jobId === undefined,
          jobTimeoutMs: String(timeoutMs),
          query,
        },
      };
    },
  };
}
