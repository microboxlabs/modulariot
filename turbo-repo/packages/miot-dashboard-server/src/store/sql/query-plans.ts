/**
 * `QueryPlanStore` in SQL, for SQLite and PostgreSQL.
 */

import { randomUUID } from "node:crypto";
import type {
  QueryColumn,
  QueryPlan,
  QueryPlanParameter,
} from "@microboxlabs/miot-dashboard-contract/authoring";
import { DashboardServerError } from "../../access/errors";
import type { QueryPlanContent, QueryPlanStore } from "../../seams/authoring";
import { placeholders, type SqlDriver, type SqlValue } from "./driver";

const COLUMNS =
  "source_id, id, name, description, project_id, location, sql_text, maximum_bytes_billed, parameters, columns, revision, updated_at, updated_by";

interface RawRow {
  source_id: string;
  id: string;
  name: string;
  description: string | null;
  project_id: string;
  location: string;
  sql_text: string;
  maximum_bytes_billed: number | string;
  parameters: string;
  columns: string | null;
  revision: string;
  updated_at: string;
  updated_by: string | null;
}

function toPlan(raw: RawRow): QueryPlan {
  return {
    id: raw.id,
    sourceId: raw.source_id,
    name: raw.name,
    ...(raw.description === null ? {} : { description: raw.description }),
    projectId: raw.project_id,
    location: raw.location,
    sql: raw.sql_text,
    // `pg` returns BIGINT as a string.
    maximumBytesBilled: Number(raw.maximum_bytes_billed),
    parameters: JSON.parse(raw.parameters) as QueryPlanParameter[],
    ...(raw.columns === null
      ? {}
      : { columns: JSON.parse(raw.columns) as QueryColumn[] }),
    revision: raw.revision,
    updatedAt: raw.updated_at,
    ...(raw.updated_by === null ? {} : { updatedBy: raw.updated_by }),
  };
}

function planValues(content: QueryPlanContent): SqlValue[] {
  return [
    content.name,
    content.name.toLowerCase(),
    content.description ?? null,
    content.projectId,
    content.location,
    content.sql,
    content.maximumBytesBilled,
    JSON.stringify(content.parameters),
    content.columns === undefined ? null : JSON.stringify(content.columns),
  ];
}

function translateNameConflict(error: unknown, name: string): never {
  if (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    "constraint" in error &&
    error.code === "23505" &&
    error.constraint === "query_plans_tenant_id_source_id_name_key_key"
  ) {
    throw DashboardServerError.conflict(
      `A query named "${name}" already exists in this source`,
    );
  }
  throw error;
}

export interface SqlQueryPlanStoreOptions {
  now?: () => Date;
  newId?: () => string;
}

export function createSqlQueryPlanStore(
  driver: SqlDriver,
  options: SqlQueryPlanStoreOptions = {},
): QueryPlanStore {
  const now = options.now ?? (() => new Date());
  const newId = options.newId ?? randomUUID;

  async function find(tenantId: string, sourceId: string, planId: string) {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<RawRow>(
      `SELECT ${COLUMNS} FROM query_plans
        WHERE tenant_id = ${p()} AND source_id = ${p()} AND id = ${p()}${driver.dialect.rowLock}`,
      [tenantId, sourceId, planId],
    );
    return rows[0] ?? null;
  }

  async function checkName(
    tenantId: string,
    sourceId: string,
    name: string,
    planId: string | null,
  ) {
    const p = placeholders(driver.dialect);
    const rows = await driver.all<{ id: string }>(
      `SELECT id FROM query_plans
        WHERE tenant_id = ${p()} AND source_id = ${p()} AND name_key = ${p()}`,
      [tenantId, sourceId, name.toLowerCase()],
    );
    if (rows.some((row) => row.id !== planId))
      throw DashboardServerError.conflict(
        `A query named "${name}" already exists in this source`,
      );
  }

  return {
    async list(tenantId, sourceId) {
      const p = placeholders(driver.dialect);
      const rows = await driver.all<RawRow>(
        `SELECT ${COLUMNS} FROM query_plans
          WHERE tenant_id = ${p()} AND source_id = ${p()}
          ORDER BY name_key, id`,
        [tenantId, sourceId],
      );
      return rows.map(toPlan);
    },

    async get(tenantId, sourceId, planId) {
      const row = await find(tenantId, sourceId, planId);
      return row === null ? null : toPlan(row);
    },

    create(tenantId, sourceId, content, actor) {
      return driver
        .transaction(async () => {
          await checkName(tenantId, sourceId, content.name, null);
          const p = placeholders(driver.dialect);
          const rows = await driver.all<RawRow>(
            `INSERT INTO query_plans
             (tenant_id, source_id, id, name, name_key, description, project_id, location,
              sql_text, maximum_bytes_billed, parameters, columns, revision, updated_at, updated_by)
           VALUES (${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()},
                   ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()}, ${p()})
           RETURNING ${COLUMNS}`,
            [
              tenantId,
              sourceId,
              newId(),
              ...planValues(content),
              newId(),
              now().toISOString(),
              actor,
            ],
          );
          if (rows[0] === undefined)
            throw new Error("Saving a query returned no row");
          return toPlan(rows[0]);
        })
        .catch((error: unknown) => translateNameConflict(error, content.name));
    },

    update(tenantId, sourceId, planId, content, expectedRevision, actor) {
      return driver
        .transaction(async () => {
          const current = await find(tenantId, sourceId, planId);
          if (current === null)
            throw DashboardServerError.notFound("Query not found");
          if (current.revision !== expectedRevision)
            throw DashboardServerError.conflict(
              "The query was saved by someone else since you opened it",
            );
          await checkName(tenantId, sourceId, content.name, planId);
          const p = placeholders(driver.dialect);
          const rows = await driver.all<RawRow>(
            `UPDATE query_plans SET
             name = ${p()}, name_key = ${p()}, description = ${p()}, project_id = ${p()},
             location = ${p()}, sql_text = ${p()}, maximum_bytes_billed = ${p()},
             parameters = ${p()}, columns = ${p()}, revision = ${p()}, updated_at = ${p()},
             updated_by = ${p()}
           WHERE tenant_id = ${p()} AND source_id = ${p()} AND id = ${p()}
           RETURNING ${COLUMNS}`,
            [
              ...planValues(content),
              newId(),
              now().toISOString(),
              actor,
              tenantId,
              sourceId,
              planId,
            ],
          );
          if (rows[0] === undefined)
            throw new Error("Saving a query returned no row");
          return toPlan(rows[0]);
        })
        .catch((error: unknown) => translateNameConflict(error, content.name));
    },

    async remove(tenantId, sourceId, planId) {
      const p = placeholders(driver.dialect);
      await driver.all(
        `DELETE FROM query_plans
          WHERE tenant_id = ${p()} AND source_id = ${p()} AND id = ${p()}`,
        [tenantId, sourceId, planId],
      );
    },
  };
}
