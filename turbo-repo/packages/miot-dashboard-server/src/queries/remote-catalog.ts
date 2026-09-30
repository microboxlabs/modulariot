import { readJsonBody } from "../http/read-json";
import { secureUrlProblem } from "../net/endpoint";
import { MIN_PROXY_KEY_LENGTH } from "../identity/proxy";
import type {
  DashboardCatalogConnection,
  DashboardQueryCatalog,
} from "../seams/query-catalog";
import { upstreamError } from "./result";

export interface RemoteQueryCatalogOptions {
  /** Private endpoint listing the tenant's dashboard-eligible operations. */
  url: string;
  proxyKey: string;
  allowHttp?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const MAX_CONNECTIONS = 100;
const MAX_OPERATIONS = 100;

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 256;
}

function connections(body: unknown): DashboardCatalogConnection[] {
  const list = (body as { connections?: unknown } | null)?.connections;
  if (!Array.isArray(list) || list.length > MAX_CONNECTIONS) throw upstreamError();
  return list.map((connection) => {
    const operations = connection?.operations;
    if (
      !text(connection?.id) ||
      !text(connection?.label) ||
      !Array.isArray(operations) ||
      operations.length > MAX_OPERATIONS
    )
      throw upstreamError();
    return {
      id: connection.id,
      label: connection.label,
      operations: operations.map((operation: unknown) => {
        const { id, label } = (operation ?? {}) as { id?: unknown; label?: unknown };
        if (!text(id) || !text(label)) throw upstreamError();
        return { id, label };
      }),
    };
  });
}

/** Lists names and ids only; the host endpoint filters to active, read-only operations. */
export function createRemoteQueryCatalog(
  options: RemoteQueryCatalogOptions,
): DashboardQueryCatalog {
  if (
    secureUrlProblem(options.url, "Catalog endpoint", options) ||
    options.proxyKey.length < MIN_PROXY_KEY_LENGTH
  )
    throw new TypeError("Invalid private catalog endpoint configuration");
  const url = new URL(options.url);
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000)
    throw new TypeError("Invalid catalog deadline");
  const fetchImpl = options.fetchImpl ?? fetch;
  let headers: Headers;
  try {
    headers = new Headers({
      "x-miot-proxy-key": options.proxyKey,
      "content-type": "application/json",
      accept: "application/json",
      "cache-control": "no-store",
    });
  } catch {
    throw new TypeError("Invalid catalog service credential");
  }
  return {
    async list({ identity, ref, signal }) {
      if (identity.tenantId !== ref.tenantId || signal.aborted) throw upstreamError();
      const deadline = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
      try {
        const response = await fetchImpl(url, {
          method: "POST",
          headers,
          redirect: "error",
          signal: deadline,
          body: JSON.stringify({ tenantId: ref.tenantId }),
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          throw upstreamError();
        }
        return connections(await readJsonBody(response, 512 * 1024));
      } catch {
        throw upstreamError();
      }
    },
  };
}
