/**
 * Folder seam — how a scope's dashboards are arranged for browsing.
 *
 * A folder only groups dashboards: it carries no config, no data and no
 * permissions of its own. Filing a dashboard in one changes where it lists,
 * never what it is or who may open it, so moving a dashboard does not touch
 * its config or bump its revision.
 *
 * Implementations throw `DashboardServerError`s: `notFound` for a folder or
 * parent that does not exist, `conflict` for a sibling name that is taken or
 * a move that would put a folder inside itself.
 */

import type { DashboardVisibility } from "@microboxlabs/miot-dashboard-contract/document";
import type { PermissionAssignment } from "./store";

export interface DashboardFolder {
  /** Assigned by the store; never reused within a scope. */
  id: string;
  name: string;
  /** Null at the top level. */
  parentId: string | null;
  /** Who made it; such a person always sees it, even when it is restricted. */
  createdBy?: string;
  /**
   * Who sees it: everyone in the scope, or only its creator, whoever its
   * permissions name and the scope's Coordinators. Absent is "organization".
   * A folder the caller cannot see hides what is inside it.
   */
  visibility?: DashboardVisibility;
}

/** Folders belong to one scope of one tenant, like the dashboards in them. */
export interface FolderScope {
  tenantId: string;
  scopeId: string;
}

export interface NewFolder {
  name: string;
  parentId: string | null;
  /** Who sees it; absent is "organization". */
  visibility?: DashboardVisibility;
}

/** Only the fields present change. */
export interface FolderPatch {
  name?: string;
  parentId?: string | null;
}

/** A folder, every folder below it, and the dashboards filed in any of them. */
export interface FolderSubtree {
  folderIds: string[];
  slugs: string[];
}

export interface DashboardFolderStore {
  /** Every folder in the scope, in no particular order. */
  list(scope: FolderScope): Promise<DashboardFolder[]>;
  /** Slug → folder id, for the dashboards that are in a folder. */
  placements(scope: FolderScope): Promise<Map<string, string>>;
  create(
    scope: FolderScope,
    input: NewFolder,
    createdBy: string,
  ): Promise<DashboardFolder>;
  update(
    scope: FolderScope,
    id: string,
    patch: FolderPatch,
  ): Promise<DashboardFolder>;
  /** Null when the folder does not exist. */
  subtree(scope: FolderScope, id: string): Promise<FolderSubtree | null>;
  /**
   * Remove the folders. A dashboard still filed in one of them — one that was
   * moved in after the caller read the subtree — goes back to the top level
   * rather than pointing at a folder that is gone.
   */
  removeFolders(scope: FolderScope, ids: readonly string[]): Promise<void>;
  /**
   * File a dashboard in a folder, or at the top level with null. Throws
   * `notFound` when the folder does not exist; returns false when the
   * dashboard does not.
   */
  placeDashboard(
    scope: FolderScope,
    slug: string,
    folderId: string | null,
  ): Promise<boolean>;
  /**
   * Every folder's own permissions, by folder id; folders with none are
   * absent. Kept apart from the dashboards': a folder's permissions say who
   * may see and change the folder, not what is inside it.
   */
  permissions(scope: FolderScope): Promise<Map<string, PermissionAssignment[]>>;
  /** Replaces one folder's permissions. Throws `notFound` for no such folder. */
  setPermissions(
    scope: FolderScope,
    folderId: string,
    assignments: readonly PermissionAssignment[],
  ): Promise<void>;
  /** Sets who sees one folder. Throws `notFound` for no such folder. */
  setVisibility(
    scope: FolderScope,
    folderId: string,
    visibility: DashboardVisibility,
  ): Promise<void>;
}
