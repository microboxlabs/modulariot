import { z } from "zod/v3";
import {
  queryEstimateSchema,
  queryPlanSchema,
  queryPlansSchema,
  queryPreviewSchema,
  querySourcesSchema,
  sourceSchema,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import type {
  QueryEstimate,
  QueryPlan,
  QueryPlanDraft,
  QueryPreview,
  QuerySource,
  SourceSchema,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { DashboardApiError } from "../client/error";
import { appendRoute, pathSegment, validateEndpoint } from "../client/routes";

/** What `QueryWorkbench` needs from a server. Hosts may implement it themselves. */
export interface QueryAuthoringClient {
  listSources(signal?: AbortSignal): Promise<QuerySource[]>;
  schema(
    sourceId: string,
    projectId: string,
    options?: { refresh?: boolean; signal?: AbortSignal },
  ): Promise<SourceSchema>;
  listPlans(sourceId: string, signal?: AbortSignal): Promise<QueryPlan[]>;
  createPlan(sourceId: string, draft: QueryPlanDraft): Promise<QueryPlan>;
  /** Fails with status 409 when someone else saved the query since `plan` was read. */
  updatePlan(
    sourceId: string,
    plan: QueryPlan,
    draft: QueryPlanDraft,
  ): Promise<QueryPlan>;
  removePlan(sourceId: string, planId: string): Promise<void>;
  estimate(
    sourceId: string,
    draft: QueryPlanDraft,
    signal?: AbortSignal,
  ): Promise<QueryEstimate>;
  preview(
    sourceId: string,
    draft: QueryPlanDraft,
    signal?: AbortSignal,
  ): Promise<QueryPreview>;
}

/** A failed request, with the server's message when it sent one. */
export class QueryAuthoringError extends DashboardApiError {
  constructor(
    status: number,
    readonly detail?: string,
  ) {
    super(status);
    this.name = "QueryAuthoringError";
  }
}

export interface QueryAuthoringClientOptions {
  /**
   * The `query-sources` collection, already bound to one tenant and scope: from
   * `createQueryAuthoringRoute`, or a host proxy that may carry a query string.
   */
  route: string;
  fetch?: typeof fetch;
  /** Resolve the current bearer token for each request; never stored. */
  getToken?: (signal?: AbortSignal) => Promise<string | null>;
  /** Direct server calls omit cookies; same-origin proxies may opt in. */
  credentials?: RequestCredentials;
}

/** The `query-sources` route of a standalone server. */
export function createQueryAuthoringRoute(options: {
  baseUrl: string;
  tenantId: string;
  scopeId: string;
}): string {
  validateEndpoint(options.baseUrl);
  if (options.baseUrl.includes("?")) throw new QueryAuthoringError(400);
  return appendRoute(
    options.baseUrl,
    undefined,
    `tenants/${pathSegment(options.tenantId)}/scopes/${pathSegment(options.scopeId)}/query-sources`,
  );
}

function withQuery(url: string, query: URLSearchParams): string {
  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

/** Client for the server's `/query-sources` routes. */
export function createQueryAuthoringClient(
  options: QueryAuthoringClientOptions,
): QueryAuthoringClient {
  validateEndpoint(options.route);
  const fetchImpl = options.fetch ?? fetch;
  const credentials = options.credentials ?? "omit";
  const root = options.route;
  const source = (sourceId: string, action: string) =>
    appendRoute(root, sourceId, action);

  async function call<T>(
    url: string,
    schema: z.ZodType<T>,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = Object.fromEntries(new Headers(init.headers));
    if (options.getToken) {
      const token = await options
        .getToken(init.signal ?? undefined)
        .catch(() => {
          throw new QueryAuthoringError(401);
        });
      if (token) headers.authorization = `Bearer ${token}`;
    }
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const response = await fetchImpl(url, {
      ...init,
      headers,
      credentials,
      cache: "no-store",
      redirect: "error",
    }).catch((error: Error) => {
      if (init.signal?.aborted) throw error;
      throw new QueryAuthoringError(502);
    });
    if (response.status === 204) {
      const empty = schema.safeParse(undefined);
      if (!empty.success) throw new QueryAuthoringError(502);
      return empty.data;
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : undefined;
      throw new QueryAuthoringError(response.status, detail);
    }
    if (!body || typeof body !== "object" || !("data" in body))
      throw new QueryAuthoringError(502);
    const parsed = schema.safeParse((body as { data: unknown }).data);
    if (!parsed.success) throw new QueryAuthoringError(502);
    return parsed.data;
  }

  const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
    method: "POST",
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  return {
    listSources: (signal) =>
      call(root, querySourcesSchema, signal ? { signal } : {}),
    schema: (sourceId, projectId, schemaOptions = {}) => {
      const query = new URLSearchParams({ projectId });
      if (schemaOptions.refresh) query.set("refresh", "1");
      return call(
        withQuery(source(sourceId, "schema"), query),
        sourceSchema,
        schemaOptions.signal ? { signal: schemaOptions.signal } : {},
      );
    },
    listPlans: (sourceId, signal) =>
      call(
        source(sourceId, "plans"),
        queryPlansSchema,
        signal ? { signal } : {},
      ),
    createPlan: (sourceId, draft) =>
      call(source(sourceId, "plans"), queryPlanSchema, post(draft)),
    updatePlan: (sourceId, plan, draft) =>
      call(source(sourceId, `plans/${pathSegment(plan.id)}`), queryPlanSchema, {
        method: "PUT",
        body: JSON.stringify(draft),
        headers: { "if-match": `"${plan.revision}"` },
      }),
    removePlan: (sourceId, planId) =>
      call(source(sourceId, `plans/${pathSegment(planId)}`), z.void(), {
        method: "DELETE",
      }),
    estimate: (sourceId, draft, signal) =>
      call(
        source(sourceId, "estimate"),
        queryEstimateSchema,
        post(draft, signal),
      ),
    preview: (sourceId, draft, signal) =>
      call(
        source(sourceId, "preview"),
        queryPreviewSchema,
        post(draft, signal),
      ),
  };
}
