import { readJsonBody } from "../http/read-json";
import { secureUrlProblem } from "../net/endpoint";
import { MIN_PROXY_KEY_LENGTH } from "../identity/proxy";
import type {
  DashboardOperationExecutor,
  DashboardOperationRequest,
} from "../seams/operations";
import {
  createBigQueryOperationExecutor,
  type ResolvedBigQueryOperation,
} from "./bigquery";
import {
  createHttpGetOperationExecutor,
  type ResolvedHttpGetOperation,
} from "./http-get";
import { upstreamError } from "./result";

export interface RemotePlanExecutorOptions {
  /** Fixed private catalog-resolution endpoint, never an execution endpoint. */
  url: string;
  proxyKey: string;
  allowHttp?: boolean;
  /** Approved data-service origins, independent of the catalog endpoint. */
  allowedDataOrigins: readonly string[];
  allowDataHttp?: boolean;
  maximumBytesBilled?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function validRequest(request: DashboardOperationRequest) {
  return (
    request.identity.tenantId === request.ref.tenantId &&
    !request.signal.aborted &&
    Number.isSafeInteger(request.limits.maxRows) &&
    request.limits.maxRows >= 1 &&
    request.limits.maxRows <= 5000 &&
    Number.isSafeInteger(request.limits.maxBytes) &&
    request.limits.maxBytes >= 1 &&
    request.limits.maxBytes <= 2 * 1024 * 1024
  );
}

function catalogHeaders(proxyKey: string) {
  try {
    return new Headers({
      "x-miot-proxy-key": proxyKey,
      "content-type": "application/json",
      accept: "application/json",
      "cache-control": "no-store",
    });
  } catch {
    throw new TypeError("Invalid plan service credential");
  }
}

/** Catalog resolution is remote; BigQuery/HTTP query execution happens in this Node process. */
export function createRemotePlanOperationExecutor(
  options: RemotePlanExecutorOptions,
): DashboardOperationExecutor {
  if (
    secureUrlProblem(options.url, "Plan endpoint", options) ||
    options.proxyKey.length < MIN_PROXY_KEY_LENGTH
  )
    throw new TypeError("Invalid private plan endpoint configuration");
  const url = new URL(options.url);
  if (!["http:", "https:"].includes(url.protocol))
    throw new TypeError("Invalid private plan endpoint configuration");
  const timeoutMs = options.timeoutMs ?? 20_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000)
    throw new TypeError("Invalid plan execution deadline");
  const fetchImpl = options.fetchImpl ?? fetch;
  const httpOptions = {
    allowedOrigins: [...options.allowedDataOrigins],
    allowHttp: options.allowDataHttp,
    fetchImpl,
    timeoutMs,
  };
  const bigQueryOptions = {
    maximumBytesBilled: options.maximumBytesBilled,
    fetchImpl,
    timeoutMs,
  };
  // Validate operator configuration before serving queries. No resolution occurs here.
  if (httpOptions.allowedOrigins.length)
    createHttpGetOperationExecutor({
      ...httpOptions,
      resolve: async () => null,
    });
  createBigQueryOperationExecutor({
    ...bigQueryOptions,
    resolve: async () => null,
  });
  const headers = catalogHeaders(options.proxyKey);
  let active = 0;
  return {
    async execute(request) {
      if (active >= 8 || !validRequest(request)) throw upstreamError();
      active++;
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(timeoutMs),
      ]);
      try {
        const body = JSON.stringify({
          tenantId: request.identity.tenantId,
          scopeId: request.ref.scopeId,
          dashboardSlug: request.ref.slug,
          userId: request.identity.userId,
          connectionId: request.connectionId,
          operationId: request.operationId,
          parameters: request.parameters,
          limits: request.limits,
        });
        if (new TextEncoder().encode(body).byteLength > 512 * 1024)
          throw upstreamError();
        const response = await fetchImpl(url, {
          method: "POST",
          headers,
          redirect: "error",
          signal,
          body,
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw upstreamError();
        }
        const resolved = await readJsonBody(response, 512 * 1024);
        signal.throwIfAborted();
        if (
          !resolved ||
          typeof resolved !== "object" ||
          !("kind" in resolved) ||
          !("operation" in resolved)
        )
          throw upstreamError();
        const input = { ...request, signal };
        if (resolved.kind === "BIGQUERY") {
          const operation = resolved.operation as ResolvedBigQueryOperation;
          return await createBigQueryOperationExecutor({
            ...bigQueryOptions,
            resolve: async () => operation,
          }).execute(input);
        }
        if (resolved.kind === "HTTP_GET") {
          const operation = resolved.operation as ResolvedHttpGetOperation;
          return await createHttpGetOperationExecutor({
            ...httpOptions,
            resolve: async () => operation,
          }).execute(input);
        }
        throw upstreamError();
      } catch {
        // Catalog responses contain credentials and SQL. They never become diagnostics or query rows.
        throw upstreamError();
      } finally {
        active--;
      }
    },
  };
}
