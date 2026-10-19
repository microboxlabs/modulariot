import { readJsonBody } from "../http/read-json";
import { MIN_PROXY_KEY_LENGTH } from "../identity/proxy";
import { secureUrlProblem } from "../net/endpoint";
import type { DashboardOperationExecutor } from "../seams/operations";
import { upstreamError, validateResult } from "./result";

export interface HttpDashboardOperationsOptions {
  /** Fixed host endpoint. Identity and operation references travel in the body. */
  url: string;
  /** Shared service credential; never supplied by dashboard editors or viewers. */
  proxyKey: string;
  /** Explicit opt-in for a trusted private-network HTTP endpoint. */
  allowHttp?: boolean;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/** Delegate execution to the host's existing connection/credential catalog. */
export function createHttpDashboardOperationExecutor(
  options: HttpDashboardOperationsOptions,
): DashboardOperationExecutor {
  if (secureUrlProblem(options.url, "Operation endpoint", options))
    throw new TypeError(
      "Operation endpoint must be a secure URL without credentials or fragments",
    );
  const url = new URL(options.url);
  if (url.protocol !== "https:" && url.protocol !== "http:")
    throw new TypeError("Operation endpoint must use HTTP or HTTPS");
  if (options.proxyKey.length < MIN_PROXY_KEY_LENGTH)
    throw new TypeError(
      `Operation proxy key must contain at least ${MIN_PROXY_KEY_LENGTH} characters`,
    );
  const headers = new Headers({
    "x-miot-proxy-key": options.proxyKey,
    "content-type": "application/json",
    accept: "application/json",
    "cache-control": "no-store",
  });
  const timeout = options.requestTimeoutMs ?? 20_000;
  if (
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > 2_147_483_647
  )
    throw new TypeError(
      "Operation timeout must be a positive timer duration",
    );
  const call = options.fetchImpl ?? fetch;
  return {
    async execute(input) {
      try {
        if (
          input.identity.tenantId !== input.ref.tenantId ||
          input.signal.aborted
        )
          throw upstreamError();
        const response = await call(url, {
          method: "POST",
          headers,
          redirect: "error",
          signal: AbortSignal.any([
            input.signal,
            AbortSignal.timeout(timeout),
          ]),
          body: JSON.stringify({
            tenantId: input.identity.tenantId,
            scopeId: input.ref.scopeId,
            dashboardSlug: input.ref.slug,
            userId: input.identity.userId,
            connectionId: input.connectionId,
            operationId: input.operationId,
            parameters: input.parameters,
            limits: input.limits,
          }),
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw upstreamError();
        }
        const body = await readJsonBody(response, input.limits.maxBytes);
        return validateResult(
          body,
          input.limits.maxRows,
          input.limits.maxBytes,
        );
      } catch {
        throw upstreamError();
      }
    },
  };
}
