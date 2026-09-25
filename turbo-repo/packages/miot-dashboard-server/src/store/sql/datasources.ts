/**
 * `DataSourceStore` in SQL, for SQLite and PostgreSQL.
 *
 * Stores descriptors only. `credential_ref` is a handle the vault resolves;
 * no secret is stored here.
 */

import type {
  DataSourceDescriptor,
  DataSourceKind,
  DataSourceStore,
} from "../../seams/datasources";
import { placeholders, type SqlDriver, type SqlValue } from "./driver";

const COLUMNS =
  "id, name, type, description, is_active, target, credential_ref, updated_at";

interface RawRow {
  id: string;
  name: string;
  type: string;
  description: string | null;
  is_active: number | boolean;
  target: string;
  credential_ref: string | null;
  updated_at: string;
}

/**
 * SQLite returns an integer. `pg` returns a number for an INTEGER column and
 * a boolean for a BOOLEAN one, and a host may have created either.
 */
function toBoolean(value: number | boolean): boolean {
  return typeof value === "boolean" ? value : value !== 0;
}

function toDescriptor(raw: RawRow): DataSourceDescriptor {
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type as DataSourceKind,
    ...(raw.description !== null ? { description: raw.description } : {}),
    isActive: toBoolean(raw.is_active),
    target: raw.target,
    ...(raw.credential_ref !== null
      ? { credentialRef: raw.credential_ref }
      : {}),
    updatedAt: raw.updated_at,
  };
}

export interface SqlDataSourceStoreOptions {
  now?: () => Date;
}

export function createSqlDataSourceStore(
  driver: SqlDriver,
  options: SqlDataSourceStoreOptions = {},
): DataSourceStore {
  const now = options.now ?? (() => new Date());

  return {
    async list(tenantId) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<RawRow>(
        `SELECT ${COLUMNS} FROM datasources
          WHERE tenant_id = ${p()}
          ORDER BY name, id`,
        [tenantId],
      );
      return rows.map(toDescriptor);
    },

    async get(tenantId, id) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<RawRow>(
        `SELECT ${COLUMNS} FROM datasources
          WHERE tenant_id = ${p()} AND id = ${p()}`,
        [tenantId, id],
      );
      return rows.length > 0 ? toDescriptor(rows[0] as RawRow) : null;
    },

    async put(tenantId, id, input) {
      const p = placeholders(driver.dialect);
      const values: SqlValue[] = [
        tenantId,
        id,
        input.name,
        input.type,
        input.description ?? null,
        input.isActive ? 1 : 0,
        input.target,
        input.credentialRef ?? null,
        now().toISOString(),
      ];
      const rows = await driver.all<RawRow>(
        `INSERT INTO datasources
           (tenant_id, id, name, type, description, is_active, target, credential_ref, updated_at)
         VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()})
         ON CONFLICT (tenant_id, id) DO UPDATE SET
           name           = excluded.name,
           type           = excluded.type,
           description    = excluded.description,
           is_active      = excluded.is_active,
           target         = excluded.target,
           credential_ref = excluded.credential_ref,
           updated_at     = excluded.updated_at
         RETURNING ${COLUMNS}`,
        values,
      );
      const row = rows[0];
      if (row === undefined) {
        throw new Error(`Writing datasource ${id} returned no row`);
      }
      return toDescriptor(row);
    },

    async remove(tenantId, id) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `DELETE FROM datasources WHERE tenant_id = ${p()} AND id = ${p()}`,
        [tenantId, id],
      );
    },
  };
}
