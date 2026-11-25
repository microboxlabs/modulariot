"use client";

/**
 * The folders an organization's dashboard is filed in, top first, for its
 * breadcrumb: "Dashboards › Ops › Daily › Fleet". Empty at the top level,
 * while loading, and where the host keeps no folders.
 */
import useSWR from "swr";
import {
  createDashboardFolderClient,
  type ServerFolder,
} from "../services/dashboard-folder-client";

export interface FolderCrumb {
  id: string;
  name: string;
}

const NONE: readonly FolderCrumb[] = [];

/** `folderId` and the folders above it, top first; stops at a cycle. */
export function folderChain(
  folders: readonly ServerFolder[],
  folderId: string | null
): FolderCrumb[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: FolderCrumb[] = [];
  const seen = new Set<string>();
  let id = folderId;
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const folder = byId.get(id);
    if (!folder) break;
    chain.unshift({ id: folder.id, name: folder.name });
    id = folder.parentId;
  }
  return chain;
}

export function useDashboardFolderPath(
  org: string,
  slug: string
): readonly FolderCrumb[] {
  const { data } = useSWR(
    ["dashboard-folder-path", org, slug],
    async () => {
      const client = createDashboardFolderClient(org);
      const [folders, dashboards] = await Promise.all([
        client.listFolders(),
        client.listDashboards(),
      ]);
      const folderId =
        dashboards.find((dashboard) => dashboard.slug === slug)?.folderId ??
        null;
      return folderChain(folders, folderId);
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
  return data ?? NONE;
}
