import { z } from "zod";
import { readJsonBody } from "../http/read-json";
import { secureUrlProblem } from "../net/endpoint";
import type {
  DashboardOperationExecutor,
  DashboardOperationRequest,
} from "../seams/operations";
import { upstreamError, validateResult } from "./result";

const name = z.string().regex(/^[A-Za-z_]\w{0,127}$/);
const value = z.union([z.string().max(2048), z.number().finite(), z.boolean()]);
const operationSchema = z
  .object({
    url: z.string().max(8192),
    readOnly: z.literal(true),
    parameterTypes: z.record(name, z.enum(["string", "number", "boolean"])),
    parameters: z.record(name, value),
    isolation: z.union([
      z
        .object({
          tenantParameter: name,
          tenantValue: z.string().min(1).max(2048),
        })
        .strict(),
      z.object({ credentialScoped: z.literal(true) }).strict(),
    ]),
    headers: z
      .record(
        z.enum(["authorization", "x-api-key", "apikey"]),
        z.string().max(8192),
      )
      .optional(),
  })
  .strict();

/** Resolved from an authorized, active, read-only host template, never a dashboard body. */
export type ResolvedHttpGetOperation = z.infer<typeof operationSchema>;
export interface HttpGetExecutorOptions {
  resolve(
    request: DashboardOperationRequest,
  ): Promise<ResolvedHttpGetOperation | null>;
  /** Operator-controlled exact origins; apply network egress policy to these trusted services. */
  allowedOrigins: readonly string[];
  /** Explicit opt-in for trusted private-network HTTP services. */
  allowHttp?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function origins(options: HttpGetExecutorOptions) {
  if (!options.allowedOrigins.length)
    throw new TypeError("HTTP operations require allowed origins");
  return new Set(
    options.allowedOrigins.map((raw) => {
      if (secureUrlProblem(raw, "HTTP operation origin", options))
        throw new TypeError("Invalid HTTP operation origin");
      const url = new URL(raw);
      if (
        !["https:", "http:"].includes(url.protocol) ||
        url.pathname !== "/" ||
        url.search
      )
        throw new TypeError("Invalid HTTP operation origin");
      return url.origin;
    }),
  );
}

function prepare(operation: unknown, allowed: Set<string>) {
  const parsed = operationSchema.safeParse(operation);
  if (!parsed.success) throw upstreamError();
  const plan = parsed.data;
  const url = new URL(plan.url);
  if (
    !allowed.has(url.origin) ||
    url.username ||
    url.password ||
    url.hash ||
    url.search
  )
    throw upstreamError();
  const entries = Object.entries(plan.parameters);
  if (
    entries.length > 100 ||
    entries.length !== Object.keys(plan.parameterTypes).length
  )
    throw upstreamError();
  for (const [key, item] of entries) {
    if (
      !Object.hasOwn(plan.parameterTypes, key) ||
      typeof item !== plan.parameterTypes[key]
    )
      throw upstreamError();
    url.searchParams.set(key, String(item));
  }
  if ("tenantParameter" in plan.isolation) {
    const { tenantParameter, tenantValue } = plan.isolation;
    if (Object.hasOwn(plan.parameters, tenantParameter)) throw upstreamError();
    url.searchParams.set(tenantParameter, tenantValue);
  }
  if (url.href.length > 16_384) throw upstreamError();
  return {
    url,
    headers: new Headers({
      ...plan.headers,
      accept: "application/json",
      "cache-control": "no-store",
      prefer: "count=exact",
    }),
  };
}

/** Portable GET execution, including PostgREST read-only RPCs returning row arrays. */
export function createHttpGetOperationExecutor(
  options: HttpGetExecutorOptions,
): DashboardOperationExecutor {
  const allowed = origins(options);
  const timeout = options.timeoutMs ?? 20_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 20_000)
    throw new TypeError("Invalid HTTP operation timeout");
  const fetcher = options.fetchImpl ?? fetch;
  let active = 0;
  return {
    async execute(request) {
      if (
        active >= 8 ||
        request.identity.tenantId !== request.ref.tenantId ||
        request.signal.aborted ||
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
        AbortSignal.timeout(timeout),
      ]);
      try {
        const resolved = await options.resolve({ ...request, signal });
        signal.throwIfAborted();
        const { url, headers } = prepare(resolved, allowed);
        const response = await fetcher(url, {
          method: "GET",
          headers,
          signal,
          redirect: "error",
        });
        if (!response.ok || response.status === 206) {
          void response.body?.cancel().catch(() => {});
          throw upstreamError();
        }
        const rows = await readJsonBody(response, request.limits.maxBytes);
        const range = response.headers.get("content-range");
        if (range) {
          const count = Array.isArray(rows) ? rows.length : -1;
          const expected = count === 0 ? "*/0" : `0-${count - 1}/${count}`;
          if (range !== expected) throw upstreamError();
        }
        return validateResult(
          { rows },
          request.limits.maxRows,
          request.limits.maxBytes,
        );
      } catch {
        throw upstreamError();
      } finally {
        active--;
      }
    },
  };
}
