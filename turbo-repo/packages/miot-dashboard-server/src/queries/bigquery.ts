import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
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

export interface BigQueryExecutorOptions {
  /** Resolve active, authorized tenant-owned catalog records and credentials. Null denies access. */
  resolve(
    request: DashboardOperationRequest,
  ): Promise<ResolvedBigQueryOperation | null>;
  maximumBytesBilled?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const dryRunSchema = z.object({
  statistics: z.object({
    totalBytesProcessed: z.string().max(20).regex(/^\d+$/),
    query: z.object({ statementType: z.literal("SELECT") }),
  }),
});
const responseSchema = z
  .object({
    error: z.unknown().optional(),
    errors: z.array(z.unknown()).optional(),
    status: z.object({ errorResult: z.unknown().optional() }).optional(),
  })
  .passthrough();

/** Portable execution: no Quarkus, Alfresco, Google SDK or framework dependency. */
export function createBigQueryOperationExecutor(
  options: BigQueryExecutorOptions,
): DashboardOperationExecutor {
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
  let active = 0;
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
      throw upstreamError();
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
      void response.body?.cancel().catch(() => {});
      throw upstreamError();
    }
    const parsed = responseSchema.safeParse(
      await readJsonBody(response, maxBytes),
    );
    if (
      !parsed.success ||
      parsed.data.error ||
      parsed.data.status?.errorResult ||
      parsed.data.errors?.length
    )
      throw upstreamError();
    return parsed.data;
  }
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
        AbortSignal.timeout(timeoutMs),
      ]);
      try {
        const resolved = await options.resolve({ ...request, signal });
        signal.throwIfAborted();
        if (!resolved?.accessToken) throw upstreamError();
        const plan = prepareBigQuery(
          resolved.plan,
          resolved.parameters,
          byteCap,
        );
        const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${plan.projectId}`;
        const dry = dryRunSchema.safeParse(
          await call(
            `${base}/jobs`,
            resolved.accessToken,
            signal,
            request.limits.maxBytes,
            plan.job(undefined, timeoutMs),
          ),
        );
        if (
          !dry.success ||
          BigInt(dry.data.statistics.totalBytesProcessed) >
            BigInt(plan.maximumBytesBilled)
        )
          throw upstreamError();
        const jobId = `dashboard_${randomUUID().replaceAll("-", "")}`;
        let completed = false;
        try {
          await call(
            `${base}/jobs`,
            resolved.accessToken,
            signal,
            request.limits.maxBytes,
            plan.job(jobId, timeoutMs),
          );
          const queryUrl = `${base}/queries/${jobId}?location=${plan.location}&maxResults=${request.limits.maxRows + 1}&timeoutMs=1000`;
          for (;;) {
            const result = await call(
              queryUrl,
              resolved.accessToken,
              signal,
              request.limits.maxBytes,
            );
            if (result.jobComplete === true) {
              const rows = bigQueryRows(
                result,
                request.limits.maxRows,
                request.limits.maxBytes,
              );
              completed = true;
              return rows;
            }
            await delay(50, undefined, { signal });
          }
        } finally {
          if (!completed) {
            await call(
              `${base}/jobs/${jobId}/cancel?location=${plan.location}`,
              resolved.accessToken,
              AbortSignal.timeout(2000),
              65_536,
              {},
            ).catch(() => {});
          }
        }
      } catch {
        throw upstreamError();
      } finally {
        active--;
      }
    },
  };
}
