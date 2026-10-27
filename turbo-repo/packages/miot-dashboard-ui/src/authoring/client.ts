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
  /** The server's base URL, or a same-origin proxy prefix. */
  baseUrl: string;
  tenantId: string;
  scopeId: string;
  fetch?: typeof fetch;
  /** Resolve the current bearer token for each request; never stored. */
  getToken?: (signal?: AbortSignal) => Promise<string | null>;
  /** Direct server calls omit cookies; same-origin proxies may opt in. */
  credentials?: RequestCredentials;
}

/** Client for the server's `/query-sources` routes. */
export function createQueryAuthoringClient(
  options: QueryAuthoringClientOptions,
): QueryAuthoringClient {
  validateEndpoint(options.baseUrl);
  const fetchImpl = options.fetch ?? fetch;
  const credentials = options.credentials ?? "omit";
  const root = appendRoute(
    options.baseUrl,
    undefined,
    `tenants/${pathSegment(options.tenantId)}/scopes/${pathSegment(options.scopeId)}/query-sources`,
  );
  const source = (sourceId: string, action: string) =>
    `${root}/${pathSegment(sourceId)}/${action}`;

  async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
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
    if (response.status === 204) return undefined as T;
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
    return (body as { data: T }).data;
  }

  const post = (body: unknown, signal?: AbortSignal): RequestInit => ({
    method: "POST",
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });

  return {
    listSources: (signal) => call(root, signal ? { signal } : {}),
    schema: (sourceId, projectId, schemaOptions = {}) => {
      const query = new URLSearchParams({ projectId });
      if (schemaOptions.refresh) query.set("refresh", "1");
      return call(
        `${source(sourceId, "schema")}?${query}`,
        schemaOptions.signal ? { signal: schemaOptions.signal } : {},
      );
    },
    listPlans: (sourceId, signal) =>
      call(source(sourceId, "plans"), signal ? { signal } : {}),
    createPlan: (sourceId, draft) =>
      call(source(sourceId, "plans"), post(draft)),
    updatePlan: (sourceId, plan, draft) =>
      call(`${source(sourceId, "plans")}/${pathSegment(plan.id)}`, {
        method: "PUT",
        body: JSON.stringify(draft),
        headers: { "if-match": `"${plan.revision}"` },
      }),
    removePlan: (sourceId, planId) =>
      call(`${source(sourceId, "plans")}/${pathSegment(planId)}`, {
        method: "DELETE",
      }),
    estimate: (sourceId, draft, signal) =>
      call(source(sourceId, "estimate"), post(draft, signal)),
    preview: (sourceId, draft, signal) =>
      call(source(sourceId, "preview"), post(draft, signal)),
  };
}
