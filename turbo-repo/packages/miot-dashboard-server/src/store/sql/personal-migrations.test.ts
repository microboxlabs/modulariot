import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresDriver } from "../postgres-driver";
import { createSqliteDriver } from "../sqlite-driver";
import { createCompositeStore } from "../composite";
import { sampleConfig } from "../../test/fixtures";
import type { SqlDriver } from "./driver";
import { createSqlDocumentStore } from "./documents";
import { createSqlMetadataStore } from "./metadata";
import { MIGRATIONS, runMigrations } from "./migrations";
import { createSqlStarStore } from "./stars";
import { createSqlRecentStore } from "./recents";

const postgresUrl = process.env.MIOT_DASHBOARD_TEST_POSTGRES_URL;
const scope = { tenantId: "acme", scopeId: "ops" };
const ref = { ...scope, slug: "fleet" };

describe.each(["sqlite", "postgres"] as const)(
  "personal dashboard migrations: %s",
  (backend) => {
    describe.skipIf(backend === "postgres" && !postgresUrl)(
      "upgrade from v10",
      () => {
        let driver: SqlDriver;
        let admin: SqlDriver | undefined;
        let schema: string;

        beforeEach(async () => {
          if (backend === "sqlite") {
            driver = createSqliteDriver({ path: ":memory:" });
          } else {
            admin = createPostgresDriver({ url: postgresUrl! });
            schema = `personal_test_${randomUUID().replaceAll("-", "")}`;
            await admin.exec(`CREATE SCHEMA ${schema}`);
            const url = new URL(postgresUrl!);
            url.searchParams.set("options", `-c search_path=${schema}`);
            driver = createPostgresDriver({ url: url.toString() });
          }
          await runMigrations(driver, {
            migrations: MIGRATIONS.filter(
              (migration) => migration.version <= 10,
            ),
          });
          await driver.exec(`INSERT INTO dashboards
          (tenant_id, scope_id, slug, name, revision, document_key, updated_at, updated_by, created_by)
          VALUES ('acme', 'ops', 'fleet', 'Fleet', 1, 'legacy', '2025-01-01T00:00:00.000Z', 'owner', 'owner')`);
          const p = driver.dialect.placeholder;
          await driver.all(
            `INSERT INTO dashboard_documents (document_key, body) VALUES (${p(1)}, ${p(2)})`,
            ["legacy", JSON.stringify(sampleConfig({ name: "Fleet" }))],
          );
        });

        afterEach(async () => {
          await driver?.close();
          if (admin) {
            await admin.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.close();
            admin = undefined;
          }
        });

        it("preserves old dashboards without inventing their creation time", async () => {
          expect(await runMigrations(driver)).toEqual([11, 12, 13]);
          expect(await runMigrations(driver)).toEqual([]);
          let tick = Date.parse("2026-11-23T12:00:00Z");
          const store = createCompositeStore({
            metadata: createSqlMetadataStore(driver),
            documents: createSqlDocumentStore(driver),
            now: () => new Date((tick += 1000)),
          });
          const legacy = await store.load(ref);
          expect(legacy?.config).toEqual(sampleConfig({ name: "Fleet" }));
          expect(legacy?.createdBy).toBe("owner");
          expect(legacy?.createdAt).toBeUndefined();
          await store.save(ref, sampleConfig(), { updatedBy: "editor" });
          expect((await store.load(ref))?.createdAt).toBeUndefined();

          const fresh = { ...scope, slug: "new" };
          await store.save(fresh, sampleConfig(), { updatedBy: "owner" });
          const first = await store.load(fresh);
          expect(first?.createdAt).toBe(first?.updatedAt);
          expect(first?.createdAt).toEqual(expect.any(String));
          await store.save(fresh, sampleConfig(), { updatedBy: "editor" });
          const edited = await store.load(fresh);
          expect(edited?.createdAt).toBe(first?.createdAt);
          expect(edited?.updatedAt).not.toBe(first?.updatedAt);
        });

        it("keeps personal rows separate across tenants, scopes and members after upgrade", async () => {
          await runMigrations(driver);
          const stars = createSqlStarStore(driver);
          const recents = createSqlRecentStore(driver);
          const neighbors = [
            { ...scope, tenantId: "other" },
            { ...scope, scopeId: "other" },
          ];
          await stars.star(scope, "ana", "fleet");
          await recents.record(scope, "ana", "fleet");
          await Promise.all(
            neighbors.map(async (neighbor) => {
              await stars.star(neighbor, "ana", "fleet");
              await recents.record(neighbor, "ana", "fleet");
            }),
          );
          await stars.star(scope, "bo", "fleet");
          await recents.record(scope, "bo", "fleet");
          await stars.forget(scope, "fleet");
          await recents.forget(scope, "fleet");
          await Promise.all(
            ["ana", "bo"].map(async (user) => {
              expect(await stars.list(scope, user)).toEqual([]);
              expect(await recents.list(scope, user, 10)).toEqual([]);
            }),
          );
          await Promise.all(
            neighbors.map(async (neighbor) => {
              expect(await stars.list(neighbor, "ana")).toEqual(["fleet"]);
              expect(await recents.list(neighbor, "ana", 10)).toEqual([
                { slug: "fleet", openedAt: expect.any(String) },
              ]);
            }),
          );
          expect(await runMigrations(driver)).toEqual([]);
          expect(await stars.list(neighbors[0]!, "ana")).toEqual(["fleet"]);
        });
      },
    );
  },
);
