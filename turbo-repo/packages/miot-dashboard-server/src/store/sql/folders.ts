/**
 * `DashboardFolderStore` in SQL, for SQLite and PostgreSQL.
 *
 * Every structural write reads the scope's folders under a row lock first, so
 * two concurrent moves cannot each pass the cycle check and together put two
 * folders inside one another. A scope holds a handful of folders, so reading
 * all of them is cheaper than walking the tree one query at a time.
 * Mount it with the dashboard store assembled from this same SqlDriver:
 * another driver connected to the same database does not share its transaction.
 */

import {
  DashboardServerError,
  isDashboardServerError,
} from "../../access/errors";
import type {
  DashboardFolder,
  DashboardFolderStore,
  FolderScope,
} from "../../seams/folders";
import {
  applyFolderPatch,
  folderNameKey,
  folderSubtree,
  requireFreeName,
  requireCompleteFolderRemoval,
  requireParent,
} from "../folder-tree";
import { placeholders, type SqlDriver } from "./driver";
import type { PermissionAssignment } from "../../seams/store";
import { isDashboardRole } from "../../access/roles";

/** The top level, as stored: '' rather than NULL (see migration 8). */
const TOP = "";

interface RawFolder {
  id: string;
  name: string;
  parent_id: string;
  created_by: string;
  /** Null for a folder saved before it had one: "organization". */
  visibility: string | null;
}

function toFolder(raw: RawFolder): DashboardFolder {
  return {
    id: raw.id,
    name: raw.name,
    parentId: raw.parent_id === TOP ? null : raw.parent_id,
    createdBy: raw.created_by,
    ...(raw.visibility === "restricted" ? { visibility: "restricted" } : {}),
  };
}

export interface SqlFolderStoreOptions {
  now?: () => Date;
  /** Id factory, overridable so tests can make ids predictable. */
  newId?: () => string;
}

/** Turns a lost race on the unique name into the same 409 the check gives. */
async function guardUnique<T>(name: string, body: () => Promise<T>) {
  try {
    return await body();
  } catch (error) {
    if (isDashboardServerError(error)) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/unique|duplicate/i.test(message)) {
      throw DashboardServerError.conflict(
        `A folder named "${name.trim()}" already exists there`,
      );
    }
    throw error;
  }
}

export function createSqlFolderStore(
  driver: SqlDriver,
  options: SqlFolderStoreOptions = {},
): DashboardFolderStore {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? (() => crypto.randomUUID());

  async function readAll(
    scope: FolderScope,
    lock = false,
  ): Promise<DashboardFolder[]> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawFolder>(
      `SELECT id, name, parent_id, created_by, visibility FROM dashboard_folders
        WHERE tenant_id = ${p()} AND scope_id = ${p()}
        ORDER BY name_key, id` + (lock ? driver.dialect.rowLock : ""),
      [scope.tenantId, scope.scopeId],
    );
    return rows.map(toFolder);
  }

  async function readPlacements(
    scope: FolderScope,
  ): Promise<Map<string, string>> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<{ slug: string; folder_id: string }>(
      `SELECT slug, folder_id FROM dashboards
        WHERE tenant_id = ${p()} AND scope_id = ${p()} AND folder_id IS NOT NULL`,
      [scope.tenantId, scope.scopeId],
    );
    return new Map(rows.map((row) => [row.slug, row.folder_id]));
  }

  function transaction<T>(
    scope: FolderScope,
    body: () => Promise<T>,
  ): Promise<T> {
    return driver.transaction(async () => {
      const lock = driver.dialect.folderLock;
      if (lock) {
        await driver.all(lock, [
          JSON.stringify([
            "miot-dashboard-folders",
            scope.tenantId,
            scope.scopeId,
          ]),
        ]);
      }
      return body();
    });
  }

  return {
    transaction,
    list: (scope) => readAll(scope),
    placements: readPlacements,

    create(scope, input, createdBy) {
      return guardUnique(input.name, () =>
        transaction(scope, async () => {
          const folders = await readAll(scope, true);
          requireParent(folders, input.parentId);
          requireFreeName(folders, input.parentId, input.name);
          const folder: DashboardFolder = {
            id: newId(),
            name: input.name.trim(),
            parentId: input.parentId,
            createdBy,
            ...(input.visibility === "restricted"
              ? { visibility: input.visibility }
              : {}),
          };
          const p = placeholders(driver.dialect);
          await driver.all(
            `INSERT INTO dashboard_folders
               (tenant_id, scope_id, id, name, name_key, parent_id, created_at, created_by, visibility)
             VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()})`,
            [
              scope.tenantId,
              scope.scopeId,
              folder.id,
              folder.name,
              folderNameKey(folder.name),
              folder.parentId ?? TOP,
              now().toISOString(),
              createdBy,
              input.visibility ?? null,
            ],
          );
          return folder;
        }),
      );
    },

    update(scope, id, patch) {
      return guardUnique(patch.name ?? "", () =>
        transaction(scope, async () => {
          const folders = await readAll(scope, true);
          const next = applyFolderPatch(folders, id, patch);
          const p = placeholders(driver.dialect);
          await driver.all(
            `UPDATE dashboard_folders
                SET name = ${p()}, name_key = ${p()}, parent_id = ${p()}
              WHERE tenant_id = ${p()} AND scope_id = ${p()} AND id = ${p()}`,
            [
              next.name,
              folderNameKey(next.name),
              next.parentId ?? TOP,
              scope.tenantId,
              scope.scopeId,
              id,
            ],
          );
          return next;
        }),
      );
    },

    async subtree(scope, id) {
      const [folders, placements] = await Promise.all([
        readAll(scope),
        readPlacements(scope),
      ]);
      return folderSubtree(folders, placements, id);
    },

    async removeFolders(scope, ids) {
      if (ids.length === 0) return;
      await transaction(scope, async () => {
        // Placement and structural writers take these locks before changing
        // references. Acquire them before clearing references as well.
        const current = await readAll(scope, true);
        requireCompleteFolderRemoval(current, ids);
        for (const id of ids) {
          const p = placeholders(driver.dialect);
          await driver.all(
            `UPDATE dashboards SET folder_id = NULL
              WHERE tenant_id = ${p()} AND scope_id = ${p()} AND folder_id = ${p()}`,
            [scope.tenantId, scope.scopeId, id],
          );
          const q = placeholders(driver.dialect);
          await driver.all(
            `DELETE FROM dashboard_folders
              WHERE tenant_id = ${q()} AND scope_id = ${q()} AND id = ${q()}`,
            [scope.tenantId, scope.scopeId, id],
          );
          const r = placeholders(driver.dialect);
          await driver.all(
            `DELETE FROM folder_permissions
              WHERE tenant_id = ${r()} AND scope_id = ${r()} AND folder_id = ${r()}`,
            [scope.tenantId, scope.scopeId, id],
          );
        }
      });
    },

    async permissions(scope) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<{
        folder_id: string;
        authority_id: string;
        role: string;
      }>(
        `SELECT folder_id, authority_id, role FROM folder_permissions
          WHERE tenant_id = ${p()} AND scope_id = ${p()}
          ORDER BY folder_id, authority_id`,
        [scope.tenantId, scope.scopeId],
      );
      const byFolder = new Map<string, PermissionAssignment[]>();
      for (const row of rows) {
        if (!isDashboardRole(row.role)) continue;
        const list = byFolder.get(row.folder_id) ?? [];
        list.push({ authorityId: row.authority_id, role: row.role });
        byFolder.set(row.folder_id, list);
      }
      return byFolder;
    },

    setPermissions(scope, folderId, assignments, visibility) {
      return transaction(scope, async () => {
        requireParent(await readAll(scope, true), folderId);
        const p = placeholders(driver.dialect);
        await driver.all(
          `DELETE FROM folder_permissions
            WHERE tenant_id = ${p()} AND scope_id = ${p()} AND folder_id = ${p()}`,
          [scope.tenantId, scope.scopeId, folderId],
        );
        for (const assignment of assignments) {
          const q = placeholders(driver.dialect);
          await driver.all(
            `INSERT INTO folder_permissions
               (tenant_id, scope_id, folder_id, authority_id, role)
             VALUES (${q()}, ${q()}, ${q()}, ${q()}, ${q()})`,
            [
              scope.tenantId,
              scope.scopeId,
              folderId,
              assignment.authorityId,
              assignment.role,
            ],
          );
        }
        if (visibility !== undefined) {
          const q = placeholders(driver.dialect);
          await driver.all(
            `UPDATE dashboard_folders SET visibility = ${q()}
              WHERE tenant_id = ${q()} AND scope_id = ${q()} AND id = ${q()}`,
            [visibility, scope.tenantId, scope.scopeId, folderId],
          );
        }
      });
    },

    setVisibility(scope, folderId, visibility) {
      return transaction(scope, async () => {
        requireParent(await readAll(scope, true), folderId);
        const p = placeholders(driver.dialect);
        await driver.all(
          `UPDATE dashboard_folders SET visibility = ${p()}
            WHERE tenant_id = ${p()} AND scope_id = ${p()} AND id = ${p()}`,
          [visibility, scope.tenantId, scope.scopeId, folderId],
        );
      });
    },

    placeDashboard(scope, slug, folderId) {
      return transaction(scope, async () => {
        if (folderId !== null) {
          // Locked, so the folder cannot be removed between this check and
          // the update below and leave the dashboard pointing at nothing.
          requireParent(await readAll(scope, true), folderId);
        }
        const p = placeholders(driver.dialect);
        const rows = await driver.all<{ slug: string }>(
          `UPDATE dashboards SET folder_id = ${p()}
            WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}
           RETURNING slug`,
          [folderId, scope.tenantId, scope.scopeId, slug],
        );
        return rows.length > 0;
      });
    },
  };
}
