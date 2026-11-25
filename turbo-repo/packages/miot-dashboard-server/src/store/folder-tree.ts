/**
 * The rules every folder store applies to a write, kept free of storage so
 * the SQL store and the in-memory one cannot disagree about them.
 */

import { DashboardServerError } from "../access/errors";
import type {
  DashboardFolder,
  FolderPatch,
  FolderSubtree,
} from "../seams/folders";

/** Case-insensitive, so "Ops" and "ops" cannot sit side by side. */
export function folderNameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Throws unless `parentId` is null or names one of `folders`. */
export function requireParent(
  folders: readonly DashboardFolder[],
  parentId: string | null,
): void {
  if (parentId !== null && !folders.some((f) => f.id === parentId)) {
    throw DashboardServerError.notFound(`Folder ${parentId} not found`);
  }
}

/** Throws when a sibling other than `selfId` already has the name. */
export function requireFreeName(
  folders: readonly DashboardFolder[],
  parentId: string | null,
  name: string,
  selfId?: string,
): void {
  const key = folderNameKey(name);
  const taken = folders.some(
    (f) =>
      f.id !== selfId &&
      f.parentId === parentId &&
      folderNameKey(f.name) === key,
  );
  if (taken) {
    throw DashboardServerError.conflict(
      `A folder named "${name.trim()}" already exists there`,
    );
  }
}

/** `id` and every folder below it, parents before children. */
export function descendantIds(
  folders: readonly DashboardFolder[],
  id: string,
): string[] {
  const result = [id];
  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    for (const folder of folders) {
      if (folder.parentId === current) result.push(folder.id);
    }
  }
  return result;
}

/**
 * The folder as it would be after `patch`, or a thrown error when the patch
 * names a missing parent, a taken name, or a parent inside the folder itself.
 */
export function applyFolderPatch(
  folders: readonly DashboardFolder[],
  id: string,
  patch: FolderPatch,
): DashboardFolder {
  const current = folders.find((f) => f.id === id);
  if (current === undefined) {
    throw DashboardServerError.notFound(`Folder ${id} not found`);
  }
  const parentId =
    patch.parentId === undefined ? current.parentId : patch.parentId;
  const name = patch.name === undefined ? current.name : patch.name.trim();
  if (parentId !== current.parentId) {
    requireParent(folders, parentId);
    if (parentId !== null && descendantIds(folders, id).includes(parentId)) {
      throw DashboardServerError.conflict(
        "A folder cannot be moved inside itself",
      );
    }
  }
  requireFreeName(folders, parentId, name, id);
  return { ...current, name, parentId };
}

/** The subtree of `id`, or null when it does not exist. */
export function folderSubtree(
  folders: readonly DashboardFolder[],
  placements: ReadonlyMap<string, string>,
  id: string,
): FolderSubtree | null {
  if (!folders.some((f) => f.id === id)) return null;
  const folderIds = descendantIds(folders, id);
  const inside = new Set(folderIds);
  const slugs = [...placements]
    .filter(([, folderId]) => inside.has(folderId))
    .map(([slug]) => slug);
  return { folderIds, slugs };
}
