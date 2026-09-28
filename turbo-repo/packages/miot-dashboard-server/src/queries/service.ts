import { dashboardQueryValueSchema } from "@microboxlabs/miot-dashboard-contract/schema";
import {
  createAccessControl,
  type AccessControlOptions,
} from "../access/access-control";
import { DashboardServerError } from "../access/errors";
import type {
  DashboardOperationExecutor,
  DashboardQueryResult,
} from "../seams/operations";
import type { ServerDashboardRef } from "../seams/store";
import { bindParameters, savedQuery } from "./bindings";

export interface DashboardQueryOptions<
  TRequest,
> extends AccessControlOptions<TRequest> {
  operations: DashboardOperationExecutor;
  /** Positive integer limits, fixed for the service's lifetime. */
  timeoutMs?: number;
  maxConcurrent?: number;
  maxRows?: number;
  maxBytes?: number;
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TypeError(`${name} must be a positive safe integer`);
  return value;
}

function upstreamError(): DashboardServerError {
  return new DashboardServerError(
    "UPSTREAM_ERROR",
    "Dashboard query could not be completed",
  );
}

function validateResult(
  result: DashboardQueryResult,
  maxRows: number,
  maxBytes: number,
) {
  if (!Array.isArray(result?.rows) || result.rows.length > maxRows)
    throw upstreamError();
  for (const row of result.rows) {
    if (typeof row !== "object" || row === null || Array.isArray(row))
      throw upstreamError();
    const values = Object.values(row);
    if (
      values.length > 100 ||
      values.some(
        (value) => !dashboardQueryValueSchema.safeParse(value).success,
      )
    )
      throw upstreamError();
  }
  const safe = { rows: result.rows };
  if (new TextEncoder().encode(JSON.stringify(safe)).byteLength > maxBytes)
    throw upstreamError();
  return safe;
}

/** Authorization and saved bindings precede every host operation. No viewer SQL. */
export function createDashboardQueryService<TRequest>(
  options: DashboardQueryOptions<TRequest>,
) {
  const access = createAccessControl(options);
  const timeoutMs = positive(options.timeoutMs ?? 20_000, "timeoutMs");
  // setTimeout overflows above this bound and would fire immediately.
  if (timeoutMs > 2_147_483_647)
    throw new TypeError("timeoutMs exceeds the timer limit");
  const maxConcurrent = positive(options.maxConcurrent ?? 8, "maxConcurrent");
  const maxRows = positive(options.maxRows ?? 5_000, "maxRows");
  const maxBytes = positive(options.maxBytes ?? 2_097_152, "maxBytes");
  let active = 0;

  async function execute(
    request: TRequest,
    ref: ServerDashboardRef,
    queryId: string,
    filters: unknown = {},
    signal?: AbortSignal,
  ) {
    const decision = await access.authorize(request, {
      ...ref,
      action: "dashboard.query",
    });
    if (decision.dashboard?.record == null)
      throw DashboardServerError.notFound("Dashboard not found");
    const query = savedQuery(decision.dashboard.record.config, queryId);
    if (signal?.aborted) throw upstreamError();
    // A host can defer body decoding until after authorization.
    const values: unknown =
      typeof filters === "function" ? await filters() : filters;
    const parameters = bindParameters(query, values);
    if (active >= maxConcurrent || signal?.aborted) throw upstreamError();
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(cancel, timeoutMs);
    active += 1;
    const operation = Promise.resolve()
      .then(() =>
        options.operations.execute({
          identity: decision.identity,
          ref: {
            tenantId: decision.identity.tenantId,
            scopeId: ref.scopeId,
            slug: ref.slug,
          },
          connectionId: query.connectionId,
          operationId: query.operationId,
          parameters,
          signal: controller.signal,
          limits: { maxRows, maxBytes },
        }),
      )
      .finally(() => {
        active -= 1;
      });
    // A timed-out adapter retains its slot until it actually settles. Ignoring
    // cancellation cannot create unlimited background work on repeated requests.
    const cancelled = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => reject(upstreamError()),
        { once: true },
      );
    });
    try {
      const result = await Promise.race([operation, cancelled]);
      return validateResult(result, maxRows, maxBytes);
    } catch {
      throw upstreamError();
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    }
  }
  return { execute };
}
