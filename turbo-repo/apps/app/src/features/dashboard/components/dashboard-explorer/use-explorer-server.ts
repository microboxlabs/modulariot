"use client";

/**
 * The explorer's server half: the active organization's dashboards and
 * folders, and the writes that change them. Every write goes to the
 * dashboard server and then reloads both lists, so what the tree shows is
 * always what the server holds.
 */
import { useCallback, useMemo } from "react";
import useSWR from "swr";
import { useOrgScopes } from "@/features/layout/components/secured-navbar/org-switcher/use-org-scopes";
import {
  createDashboardServerClient,
  DashboardApiError,
} from "@/features/dashboard/services/dashboard-server-client";
import {
  createDashboardFolderClient,
  type FolderPermissions,
} from "@/features/dashboard/services/dashboard-folder-client";
import { serverDashboardSlug } from "./dashboard-slug";
import { DEFAULT_STORAGE } from "@/features/dashboard/types/dashboard.types";
import {
  addDashboard,
  addFolder,
  EMPTY_SNAPSHOT,
  patchDashboard,
  patchFolder,
  placeDashboard,
  removeDashboard,
  removeFolder,
  type ExplorerSnapshot,
} from "./explorer-snapshot";

const DASHBOARDS_PREFIX = "/dashboards/";

/** A dashboard's explorer id is its link, which the tree also highlights by. */
export function dashboardHref(slug: string): string {
  return `${DASHBOARDS_PREFIX}${encodeURIComponent(slug)}`;
}

/** The slug back out of an explorer id; null for a folder or draft id. */
export function slugOfHref(id: string): string | null {
  if (!id.startsWith(DASHBOARDS_PREFIX)) return null;
  return decodeURIComponent(id.slice(DASHBOARDS_PREFIX.length));
}

/** `base`, or `base-1`, `base-2`… whichever no dashboard uses yet. */
export function freeSlug(name: string, taken: ReadonlySet<string>): string {
  const base = serverDashboardSlug(name) || "dashboard";
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export interface ExplorerServer extends ExplorerSnapshot {
  isLoading: boolean;
  loadError: boolean;
  /** Whether the caller may create dashboards here at all. */
  canCreate: boolean;
  /** Creates an empty dashboard, files it, and returns its explorer id. */
  createDashboard(name: string, folderId: string | null): Promise<string>;
  copyDashboard(
    id: string,
    name: string,
    folderId: string | null
  ): Promise<void>;
  deleteDashboard(id: string): Promise<void>;
  fileDashboard(id: string, folderId: string | null): Promise<void>;
  createFolder(name: string, parentId: string | null): Promise<void>;
  updateFolder(
    id: string,
    patch: { name?: string; parentId?: string | null }
  ): Promise<void>;
  deleteFolder(id: string): Promise<void>;
  /** Stars or unstars a dashboard for the signed-in user. */
  setStarred(id: string, starred: boolean): Promise<void>;
  /** Replaces a dashboard's tags, saved in its config. */
  setTags(id: string, tags: readonly string[]): Promise<void>;
  /** Renames a dashboard; the name is saved in its config, the slug stays. */
  renameDashboard(id: string, name: string): Promise<void>;
  /** A folder's own permissions, apart from its dashboards', and who sees it. */
  folderPermissions(id: string): Promise<FolderPermissions>;
  setFolderPermissions(
    id: string,
    permissions: FolderPermissions
  ): Promise<void>;
  /** Reloads the folders and dashboards. Changes do so on their own. */
  refresh(): Promise<void>;
  /**
   * The caller's last open of each dashboard, newest first, by explorer id;
   * only those still in the list. Empty until loaded.
   */
  recent: readonly { id: string; openedAt: string }[];
}

/**
 * How many opens the explorer asks for: enough for every dashboard of an
 * organization, so each card can say when the caller last opened it, not
 * only the few under "Recently opened".
 */
export const OPENS_LIMIT = 500;

/** SWR key of an organization's recents, so opening a dashboard can renew it. */
export function recentsKey(org: string) {
  return ["dashboard-explorer", org, "recents"] as const;
}

function requireSlug(id: string): string {
  const slug = slugOfHref(id);
  if (slug === null) throw new Error(`${id} is not a dashboard`);
  return slug;
}

export function useExplorerServer(): ExplorerServer {
  const { activeOrg } = useOrgScopes();
  const org = activeOrg?.slug;
  const clients = useMemo(
    () =>
      org
        ? {
            dashboards: createDashboardServerClient(org),
            folders: createDashboardFolderClient(org),
          }
        : null,
    [org]
  );

  const { data, error, isLoading, mutate } = useSWR(
    clients ? clients.folders.key : null,
    async (): Promise<ExplorerSnapshot> => {
      const [folders, dashboards, stars] = await Promise.all([
        clients!.folders.listFolders(),
        clients!.folders.listDashboards(),
        clients!.folders.listStars(),
      ]);
      const starred = new Set(stars);
      return {
        sources: dashboards.map((d) => ({
          id: dashboardHref(d.slug),
          name: d.name,
          href: dashboardHref(d.slug),
          tags: d.tags ?? [],
          starred: starred.has(d.slug),
          ...(d.createdAt ? { createdAt: d.createdAt } : {}),
          ...(d.updatedAt ? { updatedAt: d.updatedAt } : {}),
        })),
        folders: Object.fromEntries(folders.map((f) => [f.id, f])),
        placements: Object.fromEntries(
          dashboards
            .filter((d) => d.folderId !== undefined)
            .map((d) => [dashboardHref(d.slug), d.folderId ?? null])
        ),
      };
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const { data: scope } = useSWR(
    clients ? clients.dashboards.scopeKey : null,
    () => clients!.dashboards.scopeCapabilities(),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const { data: recents } = useSWR(
    clients && org ? recentsKey(org) : null,
    () => clients!.folders.listRecents(OPENS_LIMIT),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  const snapshot = data ?? EMPTY_SNAPSHOT;
  const recent = useMemo(() => {
    const listed = new Set(snapshot.sources.map((source) => source.id));
    return (recents ?? [])
      .map((open) => ({
        id: dashboardHref(open.slug),
        openedAt: open.openedAt,
      }))
      .filter((open) => listed.has(open.id));
  }, [recents, snapshot.sources]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const requireClients = useCallback(() => {
    if (!clients) throw new Error("No active organization");
    return clients;
  }, [clients]);

  const takenSlugs = useMemo(
    () =>
      new Set(
        snapshot.sources.map((s) => slugOfHref(s.id)).filter((s) => s !== null)
      ),
    [snapshot.sources]
  );

  /**
   * Writes one change. The list shows `optimistic` at once and the answer
   * the write returns as soon as it lands; the full reload runs afterwards
   * without holding anything up. A failed write puts the list back.
   */
  const change = useCallback(
    async (
      write: (current: ExplorerSnapshot) => Promise<ExplorerSnapshot>,
      optimistic?: (current: ExplorerSnapshot) => ExplorerSnapshot
    ) => {
      await mutate((current) => write(current ?? EMPTY_SNAPSHOT), {
        ...(optimistic
          ? {
              optimisticData: (current?: ExplorerSnapshot) =>
                optimistic(current ?? EMPTY_SNAPSHOT),
            }
          : {}),
        rollbackOnError: true,
        populateCache: true,
        revalidate: true,
      });
    },
    [mutate]
  );

  return useMemo<ExplorerServer>(() => {
    /** Saves `config` under a new slug and files it; returns its explorer id. */
    const saveNew = async (
      config: typeof DEFAULT_STORAGE,
      folderId: string | null
    ) => {
      const { dashboards, folders } = requireClients();
      const slug = freeSlug(config.name ?? "", takenSlugs);
      // '"0"' is "create only": an existing slug is a 409, never overwritten.
      await dashboards.save(slug, config, '"0"');
      if (folderId !== null) await folders.fileDashboard(slug, folderId);
      return dashboardHref(slug);
    };
    /** A new dashboard as the list shows it until the reload. */
    const sourceOf = (
      id: string,
      name: string,
      tags: readonly string[] = []
    ) => ({
      id,
      name,
      href: id,
      tags,
      starred: false,
      createdAt: new Date().toISOString(),
    });
    /** A change whose result is known before the server answers. */
    const known = (
      write: () => Promise<unknown>,
      apply: (current: ExplorerSnapshot) => ExplorerSnapshot
    ) =>
      change(async (current) => {
        await write();
        return apply(current);
      }, apply);

    return {
      ...snapshot,
      isLoading,
      loadError: Boolean(error),
      canCreate: scope?.canCreate === true,
      async createDashboard(name, folderId) {
        let id = "";
        await change(async (current) => {
          // Created into its setup: the first editor to open it goes
          // through permissions and tags before its first dashlet.
          id = await saveNew(
            {
              ...DEFAULT_STORAGE,
              name,
              started: false,
              // Kept to who its creator names until they open it up.
              visibility: "restricted",
            },
            folderId
          );
          return addDashboard(current, sourceOf(id, name), folderId);
        });
        return id;
      },
      async copyDashboard(id, name, folderId) {
        const { config } = await requireClients().dashboards.load(
          requireSlug(id)
        );
        await change(async (current) => {
          const copy = await saveNew(
            // A copy is its maker's: kept to who they name, like a new one.
            { ...(config ?? DEFAULT_STORAGE), name, visibility: "restricted" },
            folderId
          );
          return addDashboard(
            current,
            sourceOf(copy, name, config?.tags ?? []),
            folderId
          );
        });
      },
      deleteDashboard: (id) =>
        known(
          () => requireClients().dashboards.remove(requireSlug(id)),
          (current) => removeDashboard(current, id)
        ),
      fileDashboard: (id, folderId) =>
        known(
          () =>
            requireClients().folders.fileDashboard(requireSlug(id), folderId),
          (current) => placeDashboard(current, id, folderId)
        ),
      createFolder: (name, parentId) =>
        change(async (current) =>
          addFolder(
            current,
            await requireClients().folders.createFolder(name, parentId)
          )
        ),
      updateFolder: (id, patch) =>
        known(
          () => requireClients().folders.updateFolder(id, patch),
          (current) => patchFolder(current, id, patch)
        ),
      deleteFolder: (id) =>
        known(
          () => requireClients().folders.deleteFolder(id),
          (current) => removeFolder(current, id)
        ),
      setStarred: (id, starred) =>
        known(
          () => requireClients().folders.setStarred(requireSlug(id), starred),
          (current) => patchDashboard(current, id, { starred })
        ),
      setTags: (id, tags) =>
        known(
          async () => {
            const { dashboards } = requireClients();
            const slug = requireSlug(id);
            // Saved against the revision just read: an edit made meanwhile
            // is a 409, never overwritten.
            const { config, etag } = await dashboards.load(slug);
            if (!config) throw new DashboardApiError(404);
            await dashboards.save(slug, { ...config, tags: [...tags] }, etag);
          },
          (current) => patchDashboard(current, id, { tags: [...tags] })
        ),
      renameDashboard: (id, name) =>
        known(
          async () => {
            const { dashboards } = requireClients();
            const slug = requireSlug(id);
            // Same as tags: an edit made meanwhile is a 409, not overwritten.
            const { config, etag } = await dashboards.load(slug);
            if (!config) throw new DashboardApiError(404);
            await dashboards.save(slug, { ...config, name }, etag);
          },
          (current) => patchDashboard(current, id, { name })
        ),
      folderPermissions: (id) => requireClients().folders.folderPermissions(id),
      async setFolderPermissions(id, permissions) {
        await requireClients().folders.setFolderPermissions(id, permissions);
        // Roles on the folder, and who sees it, may have changed with them.
        await mutate();
      },
      refresh,
      recent,
    };
  }, [
    recent,
    mutate,
    snapshot,
    isLoading,
    error,
    scope,
    requireClients,
    takenSlugs,
    change,
    refresh,
  ]);
}
