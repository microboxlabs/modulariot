/**
 * What a caller may see and do with folders, and whether a dashboard or a
 * folder is hidden from them.
 *
 * Folder permissions are kept apart from the dashboards': a folder's role is
 * the highest of the caller's scope role and the folder's own permissions
 * naming them, and it says what they may do with that folder (Consumer: see
 * it; Editor: create inside, rename, move; Coordinator: delete it and manage
 * its permissions). Whoever created a folder is its Coordinator while they
 * keep Contributor standing in the scope. Nothing passes down to what is
 * inside.
 *
 * Each dashboard and folder says who sees it (`visibility`): the whole scope
 * ("organization", also when it says nothing), or — "restricted" — only the
 * scope's Coordinators, whoever created it and whoever one of its permissions
 * names. Whatever is in a folder the caller cannot see is hidden with it.
 */

import type {
  DashboardFolder,
  DashboardFolderStore,
  FolderScope,
} from "../seams/folders";
import type { DashboardIdentity } from "../seams/identity";
import type { DashboardRecord, PermissionAssignment } from "../seams/store";
import { authoritiesOf, ownsAsCreator } from "./capabilities";
import { highestRole, roleAtLeast, type DashboardRole } from "./roles";

/** What the rules read about one scope, loaded once per request. */
export interface ScopeVisibility {
  folders: ReadonlyMap<string, DashboardFolder>;
  folderPermissions: ReadonlyMap<string, readonly PermissionAssignment[]>;
  /** Dashboard slug → the folder it is filed in. */
  placements: ReadonlyMap<string, string>;
}

export const OPEN_SCOPE: ScopeVisibility = {
  folders: new Map(),
  folderPermissions: new Map(),
  placements: new Map(),
};

/**
 * Whether a dashboard's config keeps it to who it names. Anything but
 * "restricted" — absent included, as on every dashboard saved before the
 * field — leaves it to the whole scope.
 */
export function restrictedConfig(config: unknown): boolean {
  return (
    typeof config === "object" &&
    config !== null &&
    (config as { visibility?: unknown }).visibility === "restricted"
  );
}

function named(
  identity: DashboardIdentity,
  assignments: readonly PermissionAssignment[],
): PermissionAssignment[] {
  const authorities = authoritiesOf(identity);
  return assignments.filter((a) => authorities.has(a.authorityId));
}

/**
 * The caller's role on a folder: scope role or the folder's, the higher. Its
 * creator is its Coordinator (see `ownsAsCreator`), on that folder only.
 */
export function folderRoleOf(
  identity: DashboardIdentity,
  scopeRole: DashboardRole,
  folderId: string,
  scope: ScopeVisibility,
): DashboardRole {
  const own = named(identity, scope.folderPermissions.get(folderId) ?? []);
  const roles: DashboardRole[] = [scopeRole, ...own.map((a) => a.role)];
  const folder = scope.folders.get(folderId);
  if (folder && ownsAsCreator(identity, scopeRole, folder.createdBy)) {
    roles.push("Coordinator");
  }
  return highestRole(roles) ?? scopeRole;
}

/**
 * Whether the caller sees the folder: itself and every folder above it. A
 * restricted one is seen by the scope's Coordinators, its creator and whoever
 * its permissions name; any other by everyone in the scope.
 */
export function folderVisible(
  identity: DashboardIdentity,
  scopeRole: DashboardRole,
  folderId: string,
  scope: ScopeVisibility,
): boolean {
  if (!scope.folders.has(folderId)) return false;
  if (roleAtLeast(scopeRole, "Coordinator")) return true;
  const seen = new Set<string>();
  let current: string | null = folderId;
  while (current !== null) {
    if (seen.has(current)) return false;
    seen.add(current);
    const folder = scope.folders.get(current);
    if (!folder) return false;
    if (
      folder.visibility === "restricted" &&
      !namedOrCreator(
        identity,
        folder.createdBy,
        scope.folderPermissions.get(current),
      )
    ) {
      return false;
    }
    current = folder.parentId;
  }
  return true;
}

function namedOrCreator(
  identity: DashboardIdentity,
  createdBy: string | undefined,
  assignments: readonly PermissionAssignment[] = [],
): boolean {
  return (
    createdBy === identity.userId || named(identity, assignments).length > 0
  );
}

/** Moving outside any restricted ancestor can expose its contents to new callers. */
export function movementWidensVisibility(
  from: string | null,
  to: string | null,
  scope: ScopeVisibility,
): boolean {
  const restrictedAncestors = (id: string | null) => {
    const restricted = new Set<string>();
    const seen = new Set<string>();
    while (id !== null && !seen.has(id)) {
      seen.add(id);
      const folder = scope.folders.get(id);
      if (folder?.visibility === "restricted") restricted.add(id);
      id = folder?.parentId ?? null;
    }
    return restricted;
  };
  const remaining = restrictedAncestors(to);
  return [...restrictedAncestors(from)].some((id) => !remaining.has(id));
}

/**
 * Whether an existing dashboard is hidden from the caller: it is restricted
 * and they neither created it nor are named on it, or its folder is hidden
 * from them. The scope's Coordinators see everything.
 */
export function dashboardHidden(
  identity: DashboardIdentity,
  scopeRole: DashboardRole,
  slug: string,
  record: DashboardRecord | null,
  assignments: readonly PermissionAssignment[],
  scope: ScopeVisibility,
): boolean {
  if (record === null || roleAtLeast(scopeRole, "Coordinator")) return false;
  if (
    restrictedConfig(record.config) &&
    !namedOrCreator(identity, record.createdBy, assignments)
  ) {
    return true;
  }
  const folderId = scope.placements.get(slug);
  return (
    folderId !== undefined &&
    !folderVisible(identity, scopeRole, folderId, scope)
  );
}

/**
 * Loads a scope's folders, their permissions and where its dashboards are;
 * without a folder store, a scope has no folders.
 */
export function scopeVisibilityLoader(
  folders: DashboardFolderStore | undefined,
): (scope: FolderScope) => Promise<ScopeVisibility> {
  return async (scope) => {
    if (folders === undefined) return OPEN_SCOPE;
    return folders.transaction(scope, async () => {
      const [list, folderPermissions, placements] = await Promise.all([
        folders.list(scope),
        folders.permissions(scope),
        folders.placements(scope),
      ]);
      return {
        folders: new Map(list.map((f) => [f.id, f])),
        folderPermissions,
        placements,
      };
    });
  };
}
