import { DashboardApiError } from "./client/error";
export { DashboardApiError } from "./client/error";
import { appendRoute, pathSegment, validateEndpoint } from "./client/routes";
import { z } from "zod";
import {
  dashboardConfigSchema,
  dashboardQueryValueSchema,
} from "@microboxlabs/miot-dashboard-contract/schema";
import type {
  DashboardStorageSchema,
  DashboardQueryValue,
} from "@microboxlabs/miot-dashboard-contract/document";
import { DASHBOARD_ROLES } from "@microboxlabs/miot-dashboard-contract/roles";

const summarySchema = z.object({ slug: z.string(), name: z.string() });
const permissionSchema = z.object({
  authorityId: z.string().min(1),
  role: z.enum(DASHBOARD_ROLES),
});
const capabilitiesSchema = z.object({
  readOnly: z.boolean(),
  canEdit: z.boolean(),
  canShare: z.boolean(),
  canManagePermissions: z.boolean(),
  canDelete: z.boolean(),
});
const savedSchema = z.object({
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

function requireRevision(etag: string | null): string {
  if (etag === null || !/^"\d+"$/.test(etag)) {
    throw new DashboardApiError(502);
  }
  return etag;
}

/** Release unconsumed bodies without replacing the original protocol error. */
async function cancelBody(response: Response) {
  await response.body?.cancel().catch(() => undefined);
}

async function responseRevision(response: Response): Promise<string> {
  try {
    return requireRevision(response.headers.get("etag"));
  } catch (error) {
    await cancelBody(response);
    throw error;
  }
}

async function read<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body = await response.json().catch((error: Error) => {
    if (error.name === "AbortError") throw error;
    throw new DashboardApiError(502);
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new DashboardApiError(502);
  return parsed.data;
}

export interface DashboardClientOptions {
  /** Host-owned routes, already bound to one tenant/scope or organization. */
  routes: { dashboards: string; scopeCapabilities: string };
  fetch?: typeof fetch;
  /** Resolve the current bearer token for each request; never stored by this client. */
  getToken?: (signal?: AbortSignal) => Promise<string | null>;
  /** Direct server calls omit cookies; same-origin proxies may opt in. */
  credentials?: RequestCredentials;
}

/** HTTP document/query client; authentication and routing are supplied by its host. */
export function createDashboardClient(options: DashboardClientOptions) {
  const { fetch: fetchImpl = fetch, getToken, credentials = "omit" } = options;
  const dashboards = options.routes.dashboards;
  const scopeKey = options.routes.scopeCapabilities;
  validateEndpoint(dashboards);
  validateEndpoint(scopeKey);
  const url = (slug?: string, action?: string) =>
    appendRoute(dashboards, slug, action);
  async function request(path: string, init?: RequestInit) {
    const headers = Object.fromEntries(new Headers(init?.headers));
    if (getToken) {
      let token: string | null;
      try {
        token = await getToken(init?.signal ?? undefined);
      } catch {
        init?.signal?.throwIfAborted();
        throw new DashboardApiError(401);
      }
      init?.signal?.throwIfAborted();
      if (token) headers.authorization = `Bearer ${token}`;
    }
    const response = await fetchImpl(path, {
      ...init,
      headers,
      credentials,
      cache: "no-store",
      redirect: "error",
    }).catch((error: Error) => {
      if (init?.signal?.aborted) throw error;
      throw new DashboardApiError(502);
    });
    if (!response.ok) {
      await cancelBody(response);
      throw new DashboardApiError(response.status);
    }
    return response;
  }
  return {
    /** Resource URL includes the host-bound scope; hosts also isolate caches by auth session. */
    key: url,
    scopeKey,
    async scopeCapabilities(signal?: AbortSignal) {
      return read(
        await request(scopeKey, { signal }),
        z.object({ canCreate: z.boolean() }),
      );
    },
    async list(signal?: AbortSignal) {
      const result = await read(
        await request(url(), { signal }),
        z.object({ data: z.array(summarySchema) }),
      );
      return result.data;
    },
    async load(slug: string, signal?: AbortSignal) {
      const response = await request(url(slug), { signal });
      const etag = await responseRevision(response);
      const { data: config } = await read(
        response,
        z.object({ data: dashboardConfigSchema.nullable() }),
      );
      return { config, etag };
    },
    async save(
      slug: string,
      config: DashboardStorageSchema,
      etag: string,
      signal?: AbortSignal,
    ) {
      const response = await request(url(slug), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "if-match": requireRevision(etag),
        },
        body: JSON.stringify(config),
        signal,
      });
      const { data: revision } = await read(
        response,
        z.object({ data: savedSchema }),
      );
      return {
        ...revision,
        etag: requireRevision(response.headers.get("etag")),
      };
    },
    async query(
      slug: string,
      queryId: string,
      filters: Record<string, DashboardQueryValue> = {},
      signal?: AbortSignal,
    ) {
      const result = await read(
        await request(url(slug, `queries/${pathSegment(queryId)}`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ filters }),
          signal,
        }),
        z.object({
          data: z.object({
            rows: z
              .array(
                z
                  .record(z.string(), dashboardQueryValueSchema)
                  .refine((row) => Object.keys(row).length <= 100),
              )
              .max(5000),
          }),
        }),
      );
      return result.data.rows;
    },
    async capabilities(slug: string, signal?: AbortSignal) {
      return read(
        await request(url(slug, "capabilities"), { signal }),
        capabilitiesSchema,
      );
    },
    async permissions(slug: string, signal?: AbortSignal) {
      return read(
        await request(url(slug, "permissions"), { signal }),
        z.object({ assignments: z.array(permissionSchema) }),
      );
    },
    async setPermissions(
      slug: string,
      assignments: z.infer<typeof permissionSchema>[],
      signal?: AbortSignal,
    ) {
      await request(url(slug, "permissions"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
        signal,
      });
    },
    async remove(slug: string, signal?: AbortSignal) {
      await request(url(slug), { method: "DELETE", signal });
    },
  };
}

export { createDashboardRoutes } from "./client/routes";
