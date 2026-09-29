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

export class DashboardApiError extends Error {
  constructor(readonly status: number) {
    super(`Dashboard request failed (${status})`);
    this.name = "DashboardApiError";
  }
}

function requireRevision(etag: string | null): string {
  if (etag === null || !/^"\d+"$/.test(etag)) {
    throw new DashboardApiError(502);
  }
  return etag;
}

function pathSegment(value: string): string {
  if (
    !value ||
    value.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new DashboardApiError(400);
  }
  return encodeURIComponent(value);
}

/** A client is bound to one organization for its entire lifetime, including saves. */
export function createDashboardServerClient(
  orgSlug: string,
  fetchImpl: typeof fetch = fetch
) {
  if (!orgSlug) throw new DashboardApiError(400);
  const url = (slug?: string, action?: string) => {
    const suffix = slug === undefined ? "" : `/${pathSegment(slug)}`;
    const tail = action === undefined ? "" : `/${action}`;
    return `${process.env.NEXT_PUBLIC_BASE_PATH ?? "/app"}/api/dashboards${suffix}${tail}?org=${encodeURIComponent(orgSlug)}`;
  };
  const scopeKey = `${process.env.NEXT_PUBLIC_BASE_PATH ?? "/app"}/api/dashboard-capabilities?org=${encodeURIComponent(orgSlug)}`;
  async function request(path: string, init?: RequestInit) {
    const response = await fetchImpl(path, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    }).catch((error: Error) => {
      if (init?.signal?.aborted) throw error;
      throw new DashboardApiError(502);
    });
    if (!response.ok) throw new DashboardApiError(response.status);
    return response;
  }
  async function read<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
    const body = await response.json().catch(() => {
      throw new DashboardApiError(502);
    });
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new DashboardApiError(502);
    return parsed.data;
  }
  return {
    /** SWR key includes organization and slug; caches cannot cross organizations. */
    key: url,
    scopeKey,
    async scopeCapabilities(signal?: AbortSignal) {
      return read(await request(scopeKey, { signal }), z.object({ canCreate: z.boolean() }));
    },
    async list(signal?: AbortSignal) {
      const result = await read(
        await request(url(), { signal }),
        z.object({ data: z.array(summarySchema) })
      );
      return result.data;
    },
    async load(slug: string, signal?: AbortSignal) {
      const response = await request(url(slug), { signal });
      const etag = requireRevision(response.headers.get("etag"));
      const { data: config } = await read(
        response,
        z.object({ data: dashboardConfigSchema.nullable() })
      );
      return { config, etag };
    },
    async save(slug: string, config: DashboardStorageSchema, etag: string) {
      const response = await request(url(slug), {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "if-match": requireRevision(etag),
        },
        body: JSON.stringify(config),
      });
      const { data: revision } = await read(
        response,
        z.object({ data: savedSchema })
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
      signal?: AbortSignal
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
                  .refine((row) => Object.keys(row).length <= 100)
              )
              .max(5000),
          }),
        })
      );
      return result.data.rows;
    },
    async capabilities(slug: string, signal?: AbortSignal) {
      return read(
        await request(url(slug, "capabilities"), { signal }),
        capabilitiesSchema
      );
    },
    async permissions(slug: string, signal?: AbortSignal) {
      return read(
        await request(url(slug, "permissions"), { signal }),
        z.object({ assignments: z.array(permissionSchema) })
      );
    },
    async setPermissions(
      slug: string,
      assignments: z.infer<typeof permissionSchema>[]
    ) {
      await request(url(slug, "permissions"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
    },
    async remove(slug: string) {
      await request(url(slug), { method: "DELETE" });
    },
  };
}
