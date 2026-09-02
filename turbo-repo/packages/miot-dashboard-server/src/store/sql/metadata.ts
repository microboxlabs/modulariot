/**
 * The metadata store, in SQL that both SQLite and PostgreSQL accept.
 *
 * One implementation rather than two, because the entire concurrency surface
 * is three statements and both engines spell them the same way:
 *
 *   create   INSERT … ON CONFLICT DO NOTHING RETURNING *
 *   update   UPDATE … WHERE revision = $expected RETURNING *
 *   force    INSERT … ON CONFLICT DO UPDATE … RETURNING *
 *
 * Each returns the row it wrote, or nothing at all when its precondition did
 * not hold — so "did I win?" is answered by the row count, not by a second
 * read that another writer could slip past.
 */

import { isDashboardRole } from "../../access/roles";
import type {
  DashboardMetadataRow,
  DashboardMetadataStore,
  DashboardMetadataWrite,
} from "../../seams/metadata";
import type {
  PermissionAssignment,
  ServerDashboardRef,
} from "../../seams/store";
import { placeholders, type SqlDriver, type SqlValue } from "./driver";

const COLUMNS =
  "slug, name, revision, document_key, updated_at, updated_by, created_by";

interface RawRow {
  slug: string;
  name: string;
  revision: number;
  document_key: string;
  updated_at: string;
  updated_by: string;
  created_by: string | null;
}

function toRow(raw: RawRow): DashboardMetadataRow {
  return {
    slug: raw.slug,
    name: raw.name,
    // SQLite hands back whatever was stored; a text revision would break the
    // arithmetic in the conflict message rather than the comparison in SQL.
    revision: Number(raw.revision),
    documentKey: raw.document_key,
    updatedAt: raw.updated_at,
    updatedBy: raw.updated_by,
    ...(raw.created_by !== null ? { createdBy: raw.created_by } : {}),
  };
}

const first = (rows: readonly RawRow[]): DashboardMetadataRow | null =>
  rows.length > 0 ? toRow(rows[0] as RawRow) : null;

export function createSqlMetadataStore(
  driver: SqlDriver,
): DashboardMetadataStore {
  /** The three-part key, in the order every statement below binds it. */
  const refValues = (ref: ServerDashboardRef): SqlValue[] => [
    ref.tenantId,
    ref.scopeId,
    ref.slug,
  ];

  async function read(
    ref: ServerDashboardRef,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `SELECT ${COLUMNS} FROM dashboards
        WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}`,
      refValues(ref),
    );
    return first(rows);
  }

  /** Insert only. Returns nothing when the dashboard already exists. */
  async function create(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `INSERT INTO dashboards
         (tenant_id, scope_id, slug, name, revision, document_key, updated_at, updated_by, created_by)
       VALUES (${p()}, ${p()}, ${p()}, ${p()}, 1, ${p()}, ${p()}, ${p()}, ${p()})
       ON CONFLICT DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        ...refValues(ref),
        write.name,
        write.documentKey,
        write.updatedAt,
        write.updatedBy,
        // Set once, here, and never touched again: the default capability
        // policy reads it to decide whether a Contributor may edit.
        write.updatedBy,
      ],
    );
    return first(rows);
  }

  /** Update only, and only from `expectedRevision`. */
  async function update(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
    expectedRevision: number,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `UPDATE dashboards
          SET name = ${p()}, revision = revision + 1, document_key = ${p()},
              updated_at = ${p()}, updated_by = ${p()}
        WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}
          AND revision = ${p()}
       RETURNING ${COLUMNS}`,
      [
        write.name,
        write.documentKey,
        write.updatedAt,
        write.updatedBy,
        ...refValues(ref),
        expectedRevision,
      ],
    );
    return first(rows);
  }

  /** No precondition: create or bump, whichever applies. */
  async function force(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `INSERT INTO dashboards
         (tenant_id, scope_id, slug, name, revision, document_key, updated_at, updated_by, created_by)
       VALUES (${p()}, ${p()}, ${p()}, ${p()}, 1, ${p()}, ${p()}, ${p()}, ${p()})
       ON CONFLICT (tenant_id, scope_id, slug) DO UPDATE
          SET name = excluded.name,
              revision = dashboards.revision + 1,
              document_key = excluded.document_key,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by
       RETURNING ${COLUMNS}`,
      [
        ...refValues(ref),
        write.name,
        write.documentKey,
        write.updatedAt,
        write.updatedBy,
        write.updatedBy,
      ],
    );
    return first(rows);
  }

  return {
    read,

    async list(tenantId, scopeId) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<RawRow>(
        `SELECT ${COLUMNS} FROM dashboards
          WHERE tenant_id = ${p()} AND scope_id = ${p()}
          ORDER BY name, slug`,
        [tenantId, scopeId],
      );
      return rows.map(toRow);
    },

    commit(ref, write, expectedRevision) {
      if (expectedRevision === undefined) return force(ref, write);
      // Zero means "I believe this does not exist yet", which is a create and
      // must fail if someone got there first — not an update of revision 0,
      // a revision no row ever holds.
      if (expectedRevision === 0) return create(ref, write);
      return update(ref, write, expectedRevision);
    },

    async remove(ref) {
      return driver.transaction(async () => {
        const p = placeholders(driver.dialect);
        const rows = await driver.all<RawRow>(
          `DELETE FROM dashboards
            WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}
          RETURNING ${COLUMNS}`,
          refValues(ref),
        );
        const q = placeholders(driver.dialect);
        await driver.all(
          `DELETE FROM dashboard_permissions
            WHERE tenant_id = ${q()} AND scope_id = ${q()} AND slug = ${q()}`,
          refValues(ref),
        );
        return first(rows);
      });
    },

    async getPermissions(ref) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<{ authority_id: string; role: string }>(
        `SELECT authority_id, role FROM dashboard_permissions
          WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}
          ORDER BY authority_id`,
        refValues(ref),
      );
      // A role this build does not recognize is dropped rather than passed
      // on. Dropping narrows access and passing it on would widen it, and
      // only one of those two is safe to get wrong.
      return rows
        .filter((row) => isDashboardRole(row.role))
        .map((row) => ({
          authorityId: row.authority_id,
          role: row.role,
        })) as PermissionAssignment[];
    },

    async setPermissions(ref, assignments) {
      // Last assignment wins for a repeated authority. The table's primary
      // key would otherwise reject the batch, turning a duplicated id in a
      // request into a 500 instead of the harmless thing it is.
      const byAuthority = new Map<string, PermissionAssignment>();
      for (const assignment of assignments) {
        byAuthority.set(assignment.authorityId, assignment);
      }

      await driver.transaction(async () => {
        const p = placeholders(driver.dialect);
        await driver.all(
          `DELETE FROM dashboard_permissions
            WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}`,
          refValues(ref),
        );
        for (const assignment of byAuthority.values()) {
          const q = placeholders(driver.dialect);
          await driver.all(
            `INSERT INTO dashboard_permissions
               (tenant_id, scope_id, slug, authority_id, role)
             VALUES (${q()}, ${q()}, ${q()}, ${q()}, ${q()})`,
            [...refValues(ref), assignment.authorityId, assignment.role],
          );
        }
      });
    },

    close() {
      return driver.close();
    },
  };
}
