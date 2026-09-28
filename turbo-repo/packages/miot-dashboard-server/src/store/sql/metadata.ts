/**
 * `DashboardMetadataStore` in SQL that SQLite and PostgreSQL both accept.
 *
 * Three statements cover concurrency: create, update and force. Each returns
 * the row it wrote, or no rows if its condition did not match, so the result
 * decides the outcome without a second read.
 */

import { DashboardServerError } from "../../access/errors";
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
  /** The three key columns, in the order the statements bind them. */
  const refValues = (ref: ServerDashboardRef): SqlValue[] => [
    ref.tenantId,
    ref.scopeId,
    ref.slug,
  ];

  /**
   * `lock` holds the row for the rest of the transaction, for a caller about
   * to write rows that depend on this one still existing. It is a no-op on
   * SQLite, whose writers already exclude one another.
   */
  async function read(
    ref: ServerDashboardRef,
    lock = false,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `SELECT ${COLUMNS} FROM dashboards
        WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}` +
        (lock ? driver.dialect.rowLock : ""),
      refValues(ref),
    );
    return first(rows);
  }

  /** Insert only. Returns nothing when the dashboard already exists. */
  async function create(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
    revision: number,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `INSERT INTO dashboards
         (tenant_id, scope_id, slug, name, revision, document_key, updated_at, updated_by, created_by)
       VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()})
       ON CONFLICT DO NOTHING
       RETURNING ${COLUMNS}`,
      [
        ...refValues(ref),
        write.name,
        revision,
        write.documentKey,
        write.updatedAt,
        write.updatedBy,
        // created_by: set here, and no later statement updates it.
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
    revision: number,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `UPDATE dashboards
          SET name = ${p()}, revision = ${p()}, document_key = ${p()},
              updated_at = ${p()}, updated_by = ${p()}
        WHERE tenant_id = ${p()} AND scope_id = ${p()} AND slug = ${p()}
          AND revision = ${p()}
       RETURNING ${COLUMNS}`,
      [
        write.name,
        revision,
        write.documentKey,
        write.updatedAt,
        write.updatedBy,
        ...refValues(ref),
        expectedRevision,
      ],
    );
    return first(rows);
  }

  /** No condition: insert if absent, otherwise increment the revision. */
  async function force(
    ref: ServerDashboardRef,
    write: DashboardMetadataWrite,
    revision: number,
  ): Promise<DashboardMetadataRow | null> {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `INSERT INTO dashboards
         (tenant_id, scope_id, slug, name, revision, document_key, updated_at, updated_by, created_by)
       VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()})
       ON CONFLICT (tenant_id, scope_id, slug) DO UPDATE
          SET name = excluded.name,
              revision = excluded.revision,
              document_key = excluded.document_key,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by
       RETURNING ${COLUMNS}`,
      [
        ...refValues(ref),
        write.name,
        revision,
        write.documentKey,
        write.updatedAt,
        write.updatedBy,
        write.updatedBy,
      ],
    );
    return first(rows);
  }

  return {
    // Wrapped rather than passed through, so `lock` stays internal: it is not
    // part of the seam, and a caller of a method called `read` should not be
    // able to hold rows for the length of its transaction.
    read: (ref) => read(ref),

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

    async commit(ref, write, expectedRevision) {
      // This row outlives dashboard deletion. Its lock serializes writers to
      // the same address, so a recreated dashboard cannot reuse an old ETag.
      const conflict = new Error("Dashboard revision conflict");
      try {
        return await driver.transaction(async () => {
          const p = placeholders(driver.dialect);
          const [counter] = await driver.all<{ revision: number }>(
            `INSERT INTO dashboard_revisions (tenant_id, scope_id, slug, revision)
             VALUES (${p()}, ${p()}, ${p()}, 1)
             ON CONFLICT (tenant_id, scope_id, slug) DO UPDATE
               SET revision = dashboard_revisions.revision + 1
             RETURNING revision`,
            refValues(ref),
          );
          if (!counter) throw new Error("Revision counter was not returned");
          const revision = Number(counter.revision);
          let row: DashboardMetadataRow | null;
          if (expectedRevision === undefined)
            row = await force(ref, write, revision);
          else if (expectedRevision === 0)
            row = await create(ref, write, revision);
          else row = await update(ref, write, expectedRevision, revision);
          // Roll back the counter as well when the compare-and-swap failed.
          if (row === null) throw conflict;
          return row;
        });
      } catch (error) {
        if (error === conflict) return null;
        throw error;
      }
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
      // An unrecognized role is dropped rather than returned: dropping it
      // removes access, returning it could grant more than intended.
      return rows
        .filter((row) => isDashboardRole(row.role))
        .map((row) => ({
          authorityId: row.authority_id,
          role: row.role,
        })) as PermissionAssignment[];
    },

    async setPermissions(ref, assignments) {
      // A repeated authority takes its last value. Otherwise the primary key
      // rejects the insert and a duplicated id in a request becomes a 500.
      const byAuthority = new Map<string, PermissionAssignment>();
      for (const assignment of assignments) {
        byAuthority.set(assignment.authorityId, assignment);
      }

      await driver.transaction(async () => {
        // The caller authorized against a dashboard that may have been deleted
        // since. The foreign key rejects the inserts either way; reading first
        // makes that a 404 instead of a driver error. Locked, because on
        // PostgreSQL an unlocked read leaves a window in which the dashboard
        // is deleted between the check and the inserts.
        if ((await read(ref, true)) === null) {
          throw DashboardServerError.notFound(
            "Dashboard was deleted before its permissions could be written",
          );
        }
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

    async documentKeys() {
      const rows = await driver.all<{ document_key: string }>(
        "SELECT document_key FROM dashboards",
      );
      return new Set(rows.map((row) => row.document_key));
    },

    close() {
      return driver.close();
    },
  };
}
