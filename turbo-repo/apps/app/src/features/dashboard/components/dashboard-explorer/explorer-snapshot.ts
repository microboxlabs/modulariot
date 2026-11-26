/**
 * What the dashboard server holds for the explorer, and how one change
 * alters it. The changes are applied to the list the moment they are asked
 * for, so the tree does not wait for the server to answer and the list to
 * load again; a failed change is undone.
 */
import type { ExplorerFolder, ExplorerSourceFile } from "./explorer-tree.types";

export interface ExplorerSnapshot {
  sources: ExplorerSourceFile[];
  folders: Record<string, ExplorerFolder>;
  /** Dashboard id → folder id; absent at the top level. */
  placements: Record<string, string | null>;
}

export const EMPTY_SNAPSHOT: ExplorerSnapshot = {
  sources: [],
  folders: {},
  placements: {},
};

/** `id` and every folder below it. */
function folderAndBelow(
  folders: Record<string, ExplorerFolder>,
  id: string
): Set<string> {
  const gone = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of Object.values(folders)) {
      if (
        folder.parentId &&
        gone.has(folder.parentId) &&
        !gone.has(folder.id)
      ) {
        gone.add(folder.id);
        grew = true;
      }
    }
  }
  return gone;
}

function withPlacement(
  placements: Record<string, string | null>,
  id: string,
  folderId: string | null
): Record<string, string | null> {
  const next = { ...placements };
  if (folderId === null) delete next[id];
  else next[id] = folderId;
  return next;
}

export function addFolder(
  snapshot: ExplorerSnapshot,
  folder: ExplorerFolder
): ExplorerSnapshot {
  return { ...snapshot, folders: { ...snapshot.folders, [folder.id]: folder } };
}

export function patchFolder(
  snapshot: ExplorerSnapshot,
  id: string,
  patch: { name?: string; parentId?: string | null }
): ExplorerSnapshot {
  const folder = snapshot.folders[id];
  if (!folder) return snapshot;
  return {
    ...snapshot,
    folders: { ...snapshot.folders, [id]: { ...folder, ...patch } },
  };
}

/** Drops the folder, the folders below it, and the dashboards inside them. */
export function removeFolder(
  snapshot: ExplorerSnapshot,
  id: string
): ExplorerSnapshot {
  const gone = folderAndBelow(snapshot.folders, id);
  const inside = (source: ExplorerSourceFile) => {
    const folderId = snapshot.placements[source.id];
    return folderId !== undefined && folderId !== null && gone.has(folderId);
  };
  return {
    sources: snapshot.sources.filter((source) => !inside(source)),
    folders: Object.fromEntries(
      Object.entries(snapshot.folders).filter(([key]) => !gone.has(key))
    ),
    placements: Object.fromEntries(
      Object.entries(snapshot.placements).filter(
        ([, folderId]) => folderId === null || !gone.has(folderId)
      )
    ),
  };
}

export function addDashboard(
  snapshot: ExplorerSnapshot,
  source: ExplorerSourceFile,
  folderId: string | null
): ExplorerSnapshot {
  return {
    ...snapshot,
    sources: [...snapshot.sources, source],
    placements: withPlacement(snapshot.placements, source.id, folderId),
  };
}

export function removeDashboard(
  snapshot: ExplorerSnapshot,
  id: string
): ExplorerSnapshot {
  return {
    ...snapshot,
    sources: snapshot.sources.filter((source) => source.id !== id),
    placements: withPlacement(snapshot.placements, id, null),
  };
}

export function placeDashboard(
  snapshot: ExplorerSnapshot,
  id: string,
  folderId: string | null
): ExplorerSnapshot {
  return {
    ...snapshot,
    placements: withPlacement(snapshot.placements, id, folderId),
  };
}

export function patchDashboard(
  snapshot: ExplorerSnapshot,
  id: string,
  patch: Partial<Pick<ExplorerSourceFile, "name" | "tags" | "starred">>
): ExplorerSnapshot {
  return {
    ...snapshot,
    sources: snapshot.sources.map((source) =>
      source.id === id ? { ...source, ...patch } : source
    ),
  };
}
