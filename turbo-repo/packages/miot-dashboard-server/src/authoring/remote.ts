import type {
  QueryPlan,
  QuerySource,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { DashboardServerError } from "../access/errors";
import { readJsonBody } from "../http/read-json";
import { MIN_PROXY_KEY_LENGTH } from "../identity/proxy";
import { secureUrlProblem } from "../net/endpoint";
import type {
  AuthoringRequest,
  QueryAuthoring,
  QueryPlanContent,
} from "../seams/authoring";

export interface RemoteQueryAuthoringOptions {
  /** Base of the host's private authoring endpoints, e.g. `…/internal/dashboard-authoring`. */
  url: string;
  proxyKey: string;
  allowHttp?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** Drops the nulls a JVM host serializes for absent optional fields. */
function withoutNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutNulls) as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== null)
      .map(([key, item]) => [key, withoutNulls(item)]),
  ) as T;
}

function contentBody(content: QueryPlanContent) {
  return {
    name: content.name,
    description: content.description ?? null,
    projectId: content.projectId,
    location: content.location,
    sql: content.sql,
    maximumBytesBilled: content.maximumBytesBilled,
    parameters: content.parameters.map((parameter) => ({
      name: parameter.name,
      type: parameter.type,
      sample: parameter.sample ?? null,
    })),
    columns: (content.columns ?? []).map((column) => ({
      name: column.name,
      type: column.type,
      mode: column.mode ?? "NULLABLE",
    })),
  };
}

/**
 * Query authoring served by a host such as the ModularIoT modulith: it lists the
 * tenant's BigQuery connections, hands out their tokens and stores the saved
 * queries as its own operations, so dashboards run them through the host catalog.
 */
export function createRemoteQueryAuthoring(
  options: RemoteQueryAuthoringOptions,
): QueryAuthoring {
  if (
    secureUrlProblem(options.url, "Authoring endpoint", options) ||
    options.proxyKey.length < MIN_PROXY_KEY_LENGTH
  )
    throw new TypeError("Invalid private authoring endpoint configuration");
  const base = options.url.endsWith("/")
    ? options.url.slice(0, -1)
    : options.url;
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 20_000)
    throw new TypeError("Invalid authoring deadline");
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
    throw new TypeError("Invalid authoring service credential");
  }

  /** The parsed body, or null for a 404. Other failures throw. */
  async function call(
    action: string,
    body: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const deadline = AbortSignal.any([
      ...(signal ? [signal] : []),
      AbortSignal.timeout(timeoutMs),
    ]);
    let response: Response;
    try {
      response = await fetchImpl(`${base}/${action}`, {
        method: "POST",
        headers,
        redirect: "error",
        signal: deadline,
        body: JSON.stringify(body),
      });
    } catch {
      throw new DashboardServerError(
        "UPSTREAM_ERROR",
        "The query store could not be reached",
      );
    }
    if (response.status === 204) return undefined;
    const parsed = await readJsonBody(response, MAX_RESPONSE_BYTES).catch(
      () => null,
    );
    if (response.ok) return withoutNulls(parsed);
    const message =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error: unknown }).error).slice(0, 500)
        : `The query store answered ${response.status}`;
    if (response.status === 404) return null;
    if (response.status === 400) throw DashboardServerError.badRequest(message);
    if (response.status === 409) throw DashboardServerError.conflict(message);
    throw new DashboardServerError("UPSTREAM_ERROR", message);
  }

  const who = (request: AuthoringRequest) => ({
    tenantId: request.identity.tenantId,
    userId: request.identity.userId,
  });

  return {
    async listSources(request) {
      const sources = await call("sources", who(request), request.signal);
      return Array.isArray(sources) ? (sources as QuerySource[]) : [];
    },

    async accessFor(request) {
      const access = await call(
        "access",
        { ...who(request), sourceId: request.sourceId },
        request.signal,
      );
      if (
        !access ||
        typeof access !== "object" ||
        typeof (access as { accessToken?: unknown }).accessToken !== "string"
      )
        return null;
      return access as { accessToken: string; expiresAt?: string };
    },

    plans: {
      async list(tenantId, sourceId) {
        const plans = await call("plans/list", { tenantId, sourceId });
        if (plans === null)
          throw DashboardServerError.notFound("Query source not found");
        return plans as QueryPlan[];
      },
      async get(tenantId, sourceId, planId) {
        return (await call("plans/get", {
          tenantId,
          sourceId,
          planId,
        })) as QueryPlan | null;
      },
      async create(tenantId, sourceId, content, actor) {
        const plan = await call("plans/create", {
          tenantId,
          userId: actor,
          sourceId,
          content: contentBody(content),
        });
        if (plan === null)
          throw DashboardServerError.notFound("Query source not found");
        return plan as QueryPlan;
      },
      async update(
        tenantId,
        sourceId,
        planId,
        content,
        expectedRevision,
        actor,
      ) {
        const plan = await call("plans/update", {
          tenantId,
          userId: actor,
          sourceId,
          planId,
          content: contentBody(content),
          expectedRevision,
        });
        if (plan === null)
          throw DashboardServerError.notFound("Query not found");
        return plan as QueryPlan;
      },
      async remove(tenantId, sourceId, planId) {
        await call("plans/remove", { tenantId, sourceId, planId });
      },
    },
  };
}
