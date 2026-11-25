import { z } from "zod";
import { DashboardApiError } from "./dashboard-server-client";

/**
 * The dashboard server's folders, stars and recents, through the app's own
 * routes.
 * Kept apart from `createDashboardServerClient`, whose listing drops fields
 * it does not know: this one reads the dashboard list again to keep each
 * `folderId` and `tags`.
 */

const roleSchema = z.enum(["Consumer", "Contributor", "Editor", "Coordinator"]);

const folderSchema = z.object({
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  /** The caller's role on the folder; listed only by servers that have it. */
  role: roleSchema.optional(),
});

const assignmentsSchema = z.object({
  assignments: z.array(z.object({ authorityId: z.string(), role: roleSchema })),
});

/** A folder's own permissions and who sees it; absent is the organization. */
const folderPermissionsSchema = assignmentsSchema.extend({
  visibility: z.enum(["organization", "restricted"]).default("organization"),
});

const filedSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  folderId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  /** ISO-8601; absent for dashboards saved before the server recorded it. */
  createdAt: z.string().optional(),
  /** ISO-8601, its last save; absent from servers that do not send it. */
  updatedAt: z.string().optional(),
});

const recentOpenSchema = z.object({
  slug: z.string(),
  /** ISO-8601, the caller's latest open of it. */
  openedAt: z.string(),
});

export type ServerFolder = z.infer<typeof folderSchema>;
export type RecentOpen = z.infer<typeof recentOpenSchema>;
export type FiledDashboard = z.infer<typeof filedSummarySchema>;
export type FolderRole = z.infer<typeof roleSchema>;
export type FolderAssignment = z.infer<
  typeof assignmentsSchema
>["assignments"][number];
export type FolderPermissions = z.infer<typeof folderPermissionsSchema>;

/** `read()`, or `fallback` when the route is not served at all (404). */
async function whenServed<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof DashboardApiError && error.status === 404) {
      return fallback;
    }
    throw error;
  }
}

export function createDashboardFolderClient(
  orgSlug: string,
  fetchImpl: typeof fetch = fetch
) {
  if (!orgSlug) throw new DashboardApiError(400);
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/app";
  const query = `?org=${encodeURIComponent(orgSlug)}`;
  const folders = (id?: string) => {
    const one = id ? `/${encodeURIComponent(id)}` : "";
    return `${base}/api/dashboard-folders${one}${query}`;
  };
  const dashboardFolder = (slug: string) =>
    `${base}/api/dashboards/${encodeURIComponent(slug)}/folder${query}`;
  const folderPermissions = (id: string) =>
    `${base}/api/dashboard-folders/${encodeURIComponent(id)}/permissions${query}`;
  const dashboardStar = (slug: string) =>
    `${base}/api/dashboards/${encodeURIComponent(slug)}/star${query}`;
  const dashboardOpen = (slug: string) =>
    `${base}/api/dashboards/${encodeURIComponent(slug)}/open${query}`;

  async function send(
    url: string,
    method: string,
    body?: unknown
  ): Promise<Response> {
    const response = await fetchImpl(url, {
      method,
      credentials: "same-origin",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
    if (!response.ok) throw new DashboardApiError(response.status);
    return response;
  }

  async function read<T>(response: Response, schema: z.ZodType<T>) {
    const parsed = z.object({ data: schema }).safeParse(await response.json());
    if (!parsed.success) throw new DashboardApiError(502);
    return parsed.data.data;
  }

  return {
    /** SWR key for everything this client lists, per organization. */
    key: ["dashboard-explorer", orgSlug] as const,
    /**
     * The scope's folders; none where they are not served (an older proxy
     * answers 404), so the dashboards still list, just without folders.
     */
    async listFolders(): Promise<ServerFolder[]> {
      return whenServed(
        async () => read(await send(folders(), "GET"), z.array(folderSchema)),
        []
      );
    },
    async listDashboards(): Promise<FiledDashboard[]> {
      const url = `${base}/api/dashboards${query}`;
      return read(await send(url, "GET"), z.array(filedSummarySchema));
    },
    async createFolder(
      name: string,
      parentId: string | null
    ): Promise<ServerFolder> {
      return read(
        await send(folders(), "POST", { name, parentId }),
        folderSchema
      );
    },
    async updateFolder(
      id: string,
      patch: { name?: string; parentId?: string | null }
    ): Promise<void> {
      await send(folders(id), "PATCH", patch);
    },
    async deleteFolder(id: string): Promise<void> {
      await send(folders(id), "DELETE");
    },
    async fileDashboard(slug: string, folderId: string | null): Promise<void> {
      await send(dashboardFolder(slug), "PUT", { folderId });
    },
    /** The caller's starred slugs; none where the server keeps no stars. */
    async listStars(): Promise<string[]> {
      return whenServed(
        async () =>
          read(
            await send(`${base}/api/dashboard-stars${query}`, "GET"),
            z.array(z.string())
          ),
        []
      );
    },
    async setStarred(slug: string, starred: boolean): Promise<void> {
      await send(dashboardStar(slug), starred ? "PUT" : "DELETE");
    },
    /**
     * The caller's latest opens, newest first; none where the server keeps
     * no recents.
     */
    async listRecents(limit: number): Promise<RecentOpen[]> {
      return whenServed(
        async () =>
          read(
            await send(
              `${base}/api/dashboard-recents${query}&limit=${limit}`,
              "GET"
            ),
            z.array(recentOpenSchema)
          ),
        []
      );
    },
    /** Notes that the caller opened `slug`; ignored where it is not served. */
    async recordOpen(slug: string): Promise<void> {
      await whenServed(() => send(dashboardOpen(slug), "PUT"), undefined);
    },
    /** A folder's own permissions, apart from its dashboards', and who sees it. */
    async folderPermissions(id: string): Promise<FolderPermissions> {
      const response = await send(folderPermissions(id), "GET");
      const parsed = folderPermissionsSchema.safeParse(await response.json());
      if (!parsed.success) throw new DashboardApiError(502);
      return parsed.data;
    },
    async setFolderPermissions(
      id: string,
      { assignments, visibility }: FolderPermissions
    ): Promise<void> {
      await send(folderPermissions(id), "PUT", { assignments, visibility });
    },
  };
}
