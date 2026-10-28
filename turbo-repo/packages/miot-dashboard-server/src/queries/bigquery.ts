import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod/v3";
import type { DashboardQueryValue } from "@microboxlabs/miot-dashboard-contract/document";
import { isDashboardServerError } from "../access/errors";
import { readJsonBody } from "../http/read-json";
import type {
  DashboardOperationExecutor,
  DashboardOperationRequest,
} from "../seams/operations";
import { prepareBigQuery, type BigQueryPlan } from "./bigquery-plan";
import { bigQueryRows } from "./bigquery-rows";
import { upstreamError } from "./result";

export type { BigQueryPlan } from "./bigquery-plan";

export interface ResolvedBigQueryOperation {
  plan: BigQueryPlan;
  /** Includes host-enforced tenant predicates; never interpolate values into SQL. */
  parameters: DashboardOperationRequest["parameters"];
  /** Short-lived OAuth token, resolved server-side with jobs.insert permission. */
  accessToken: string;
}

export interface BigQueryRunnerOptions {
  maximumBytesBilled?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface BigQueryExecutorOptions extends BigQueryRunnerOptions {
  /** Resolve active, authorized tenant-owned catalog records and credentials. Null denies access. */
  resolve(
    request: DashboardOperationRequest,
  ): Promise<ResolvedBigQueryOperation | null>;
}

/**
 * A refusal with a message for the author of a query: BigQuery's own error, or
 * the limit the query breaks. Dashboard viewers never see it.
 */
export class BigQueryProblem extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BigQueryProblem";
  }
}

export interface BigQueryDryRun {
  statementType: string;
  totalBytesProcessed: bigint;
  /** `schema.fields` of the result, as BigQuery reports them. */
  fields: unknown[];
}

const dryRunSchema = z.object({
  statistics: z.object({
    totalBytesProcessed: z.string().max(20).regex(/^\d+$/),
    query: z.object({
      statementType: z.string().max(64),
      schema: z.object({ fields: z.array(z.unknown()).optional() }).optional(),
    }),
  }),
});
const responseSchema = z
  .object({
    error: z.unknown().optional(),
    errors: z.array(z.unknown()).optional(),
    status: z.object({ errorResult: z.unknown().optional() }).optional(),
  })
  .passthrough();
const errorSchema = z.object({
  error: z.object({ message: z.string().optional() }).optional(),
  status: z
    .object({
      errorResult: z.object({ message: z.string().optional() }).optional(),
    })
    .optional(),
});

function problemOf(body: unknown, fallback: string): BigQueryProblem {
  const parsed = errorSchema.safeParse(body);
  const message = parsed.success
    ? (parsed.data.error?.message ?? parsed.data.status?.errorResult?.message)
    : undefined;
  return new BigQueryProblem(message ? message.slice(0, 2000) : fallback);
}

/**
 * The BigQuery calls behind every query, shared by the dashboard executor and
 * the query editor. Failures throw `BigQueryProblem` with BigQuery's message.
 */
export function createBigQueryRunner(options: BigQueryRunnerOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const byteCap = options.maximumBytesBilled ?? 1_000_000_000;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 20_000 ||
    !Number.isSafeInteger(byteCap) ||
    byteCap < 1
  )
    throw new TypeError("Invalid BigQuery execution limits");
  const fetcher = options.fetchImpl ?? fetch;

  async function call(
    url: string,
    token: string,
    signal: AbortSignal,
    maxBytes: number,
    body?: object,
  ) {
    signal.throwIfAborted();
    const encoded = body ? JSON.stringify(body) : undefined;
    if (encoded && new TextEncoder().encode(encoded).byteLength > 512 * 1024)
      throw new BigQueryProblem("The request to BigQuery is too large");
    const response = await fetcher(url, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      ...(encoded ? { body: encoded } : {}),
    });
    if (!response.ok) {
      const failure = await readJsonBody(response, 65_536).catch(() => null);
      throw problemOf(failure, `BigQuery answered ${response.status}`);
    }
    let received: unknown;
    try {
      received = await readJsonBody(response, maxBytes);
    } catch (error) {
      throw new BigQueryProblem(
        isDashboardServerError(error) && error.code === "PAYLOAD_TOO_LARGE"
          ? `The result is larger than ${maxBytes} bytes`
          : "BigQuery answered with an unreadable body",
      );
    }
    const parsed = responseSchema.safeParse(received);
    if (!parsed.success)
      throw new BigQueryProblem("Unexpected BigQuery answer");
    if (
      parsed.data.error ||
      parsed.data.status?.errorResult ||
      parsed.data.errors?.length
    )
      throw problemOf(parsed.data, "BigQuery refused the query");
    return parsed.data;
  }

  function prepare(
    plan: BigQueryPlan,
    values: Record<string, DashboardQueryValue>,
  ) {
    try {
      return prepareBigQuery(plan, values, byteCap);
    } catch {
      throw new BigQueryProblem(
        `The query plan is invalid or allows more than ${byteCap} bytes`,
      );
    }
  }

  const projectUrl = (projectId: string) =>
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}`;

  /** Free. Checks neither the statement type nor the byte limit. */
  async function dryRun(
    plan: BigQueryPlan,
    values: Record<string, DashboardQueryValue>,
    token: string,
    signal: AbortSignal,
  ): Promise<BigQueryDryRun> {
    const prepared = prepare(plan, values);
    const dry = dryRunSchema.safeParse(
      await call(
        `${projectUrl(prepared.projectId)}/jobs`,
        token,
        signal,
        1024 * 1024,
        prepared.job(undefined, timeoutMs),
      ),
    );
    if (!dry.success) throw new BigQueryProblem("Unexpected BigQuery answer");
    return {
      statementType: dry.data.statistics.query.statementType,
      totalBytesProcessed: BigInt(dry.data.statistics.totalBytesProcessed),
      fields: dry.data.statistics.query.schema?.fields ?? [],
    };
  }

  /**
   * Dry run, then the job. Reads up to `maxRows + 1` rows so a caller can tell
   * a complete result from a cut one, and cancels the job when it fails.
   */
  async function run<T>(
    plan: BigQueryPlan,
    values: Record<string, DashboardQueryValue>,
    token: string,
    signal: AbortSignal,
    limits: { maxRows: number; maxBytes: number },
    read: (result: Record<string, unknown>) => T,
  ): Promise<T> {
    const prepared = prepare(plan, values);
    const dry = await dryRun(plan, values, token, signal);
    if (dry.statementType !== "SELECT")
      throw new BigQueryProblem(
        `Only SELECT statements run in a dashboard; this one is ${dry.statementType}`,
      );
    if (dry.totalBytesProcessed > BigInt(prepared.maximumBytesBilled))
      throw new BigQueryProblem(
        `The query reads ${dry.totalBytesProcessed} bytes, above its limit of ${prepared.maximumBytesBilled}`,
      );
    const url = projectUrl(prepared.projectId);
    const jobId = `dashboard_${randomUUID().replaceAll("-", "")}`;
    let completed = false;
    try {
      await call(
        `${url}/jobs`,
        token,
        signal,
        limits.maxBytes,
        prepared.job(jobId, timeoutMs),
      );
      const queryUrl = `${url}/queries/${jobId}?location=${prepared.location}&maxResults=${limits.maxRows + 1}&timeoutMs=1000`;
      for (;;) {
        const result = await call(queryUrl, token, signal, limits.maxBytes);
        if (result.jobComplete === true) {
          const rows = read(result);
          completed = true;
          return rows;
        }
        await delay(50, undefined, { signal });
      }
    } finally {
      if (!completed) {
        await call(
          `${url}/jobs/${jobId}/cancel?location=${prepared.location}`,
          token,
          AbortSignal.timeout(2000),
          65_536,
          {},
        ).catch(() => {});
      }
    }
  }

  return { timeoutMs, byteCap, call, dryRun, run };
}

/** Portable execution: no Quarkus, Alfresco, Google SDK or framework dependency. */
export function createBigQueryOperationExecutor(
  options: BigQueryExecutorOptions,
): DashboardOperationExecutor {
  const runner = createBigQueryRunner(options);
  let active = 0;
  return {
    async execute(request) {
      if (
        active >= 8 ||
        request.identity.tenantId !== request.ref.tenantId ||
        request.signal.aborted
      )
        throw upstreamError();
      if (
        !Number.isSafeInteger(request.limits.maxRows) ||
        request.limits.maxRows < 1 ||
        request.limits.maxRows > 5000 ||
        !Number.isSafeInteger(request.limits.maxBytes) ||
        request.limits.maxBytes < 1 ||
        request.limits.maxBytes > 2 * 1024 * 1024
      )
        throw upstreamError();
      active++;
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(runner.timeoutMs),
      ]);
      try {
        const resolved = await options.resolve({ ...request, signal });
        signal.throwIfAborted();
        if (!resolved?.accessToken) throw upstreamError();
        return await runner.run(
          resolved.plan,
          resolved.parameters,
          resolved.accessToken,
          signal,
          request.limits,
          (result) =>
            bigQueryRows(
              result,
              request.limits.maxRows,
              request.limits.maxBytes,
            ),
        );
      } catch {
        // Viewers never see BigQuery's diagnostics.
        throw upstreamError();
      } finally {
        active--;
      }
    },
  };
}
