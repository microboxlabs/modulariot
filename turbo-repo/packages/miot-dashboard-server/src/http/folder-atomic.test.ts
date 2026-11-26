import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createDashboardHandler } from "./handler";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryFolderStore,
  createMemoryScopeAuthority,
  createMemoryStore,
  createMemoryTenantAuthority,
} from "../testing";
import { openSqliteStore, SQLITE_MEMORY } from "../store/sqlite";
import { openPostgresStore } from "../store/postgres";
import { createPostgresDriver } from "../store/postgres-driver";
import { createSqlFolderStore } from "../store/sql/folders";
import type { OpenedStore } from "../store/sql/open";
import type { SqlDriver } from "../store/sql/driver";
import { sampleConfig } from "../test/fixtures";

const scope = { tenantId: "acme", scopeId: "ops" };
const ref = { ...scope, slug: "fleet" };
const postgresUrl = process.env.MIOT_DASHBOARD_TEST_POSTGRES_URL;

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

describe.each(["memory", "sqlite", "postgres"] as const)(
  "atomic folders: %s",
  (backend) => {
    describe.skipIf(backend === "postgres" && !postgresUrl)(
      "scope transactions",
      () => {
        let opened: OpenedStore | undefined;
        let admin: SqlDriver | undefined;
        let schema: string;

        afterEach(async () => {
          await opened?.close();
          opened = undefined;
          if (admin) {
            await admin.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
            await admin.close();
            admin = undefined;
          }
        });

        async function setup() {
          if (backend === "sqlite")
            opened = await openSqliteStore({ path: SQLITE_MEMORY });
          if (backend === "postgres") {
            admin = createPostgresDriver({ url: postgresUrl! });
            schema = `folder_test_${randomUUID().replaceAll("-", "")}`;
            await admin.exec(`CREATE SCHEMA ${schema}`);
            const url = new URL(postgresUrl!);
            url.searchParams.set("options", `-c search_path=${schema}`);
            opened = await openPostgresStore({ url: url.toString() });
          }
          const memory = createMemoryStore();
          const store = opened?.store ?? memory;
          const folders = opened
            ? createSqlFolderStore(opened.driver)
            : createMemoryFolderStore(memory);
          await store.save(ref, sampleConfig(), { updatedBy: "owner" });
          const parent = await folders.create(
            scope,
            { name: "Parent", parentId: null },
            "owner",
          );
          const child = await folders.create(
            scope,
            { name: "Child", parentId: parent.id },
            "owner",
          );
          await folders.placeDashboard(scope, ref.slug, child.id);
          const memberships = {
            acme: {
              ops: { owner: "Coordinator" as const, bob: "Consumer" as const },
            },
          };
          const handler = createDashboardHandler({
            store,
            folders,
            identity: createInsecureHeaderIdentityResolver(),
            tenants: createMemoryTenantAuthority(memberships),
            scopes: createMemoryScopeAuthority(memberships),
          });
          const remove = (user = "owner") =>
            handler(
              new Request(
                `http://localhost/tenants/acme/scopes/ops/folders/${parent.id}`,
                {
                  method: "DELETE",
                  headers: { "x-dev-user": user },
                },
              ),
            );
          const pauseAuthorization = () => {
            const entered = gate();
            const finish = gate();
            const permissions = store.getPermissions.bind(store);
            store.getPermissions = async (target) => {
              const assignments = await permissions(target);
              entered.release();
              await finish.promise;
              return assignments;
            };
            return { entered, finish };
          };
          return {
            store,
            folders,
            parent,
            child,
            remove,
            pauseAuthorization,
            handler,
          };
        }

        it("does not combine an old public config with a new public placement", async () => {
          const { store, folders, parent, handler } = await setup();
          await folders.setVisibility(scope, parent.id, "restricted");
          const entered = gate();
          const finish = gate();
          const load = store.load.bind(store);
          store.load = async (target) => {
            const record = await load(target);
            entered.release();
            await finish.promise;
            return record;
          };
          const reading = handler(
            new Request(
              "http://localhost/tenants/acme/scopes/ops/dashboards/fleet",
              {
                headers: { "x-dev-user": "bob" },
              },
            ),
          );
          await entered.promise;
          const writing = folders.transaction(scope, async () => {
            await store.save(ref, sampleConfig({ visibility: "restricted" }), {
              updatedBy: "owner",
            });
            await folders.placeDashboard(scope, ref.slug, null);
          });
          finish.release();
          expect((await reading).status).toBe(403);
          await writing;
        });

        it("serializes a move out of the subtree with its authorized deletion", async () => {
          const { store, folders, remove, pauseAuthorization } = await setup();
          const { entered, finish } = pauseAuthorization();
          const deleting = remove();
          await entered.promise;
          const moving = folders.placeDashboard(scope, ref.slug, null);
          finish.release();
          expect((await deleting).status).toBe(204);
          expect(await moving).toBe(false);
          expect(await store.load(ref)).toBeNull();
        });

        it("rejects a new child queued behind deletion instead of orphaning it", async () => {
          const { folders, parent, remove, pauseAuthorization } = await setup();
          const { entered, finish } = pauseAuthorization();
          const deleting = remove();
          await entered.promise;
          const creating = folders.create(
            scope,
            { name: "Late", parentId: parent.id },
            "owner",
          );
          const rejected = expect(creating).rejects.toMatchObject({
            code: "NOT_FOUND",
          });
          finish.release();
          expect((await deleting).status).toBe(204);
          await rejected;
          expect(await folders.list(scope)).toEqual([]);
        });

        it("keeps a dashboard moved out before the deletion transaction", async () => {
          const { store, folders, remove } = await setup();
          expect(await folders.placeDashboard(scope, ref.slug, null)).toBe(
            true,
          );
          expect((await remove()).status).toBe(204);
          expect(await store.load(ref)).not.toBeNull();
        });

        it("checks management rights on every descendant, including empty folders", async () => {
          const { folders, parent, remove } = await setup();
          await folders.placeDashboard(scope, ref.slug, null);
          await folders.setPermissions(scope, parent.id, [
            { authorityId: "bob", role: "Coordinator" },
          ]);
          expect((await remove("bob")).status).toBe(403);
          expect(await folders.list(scope)).toHaveLength(2);
        });

        it("rolls back dashboard deletion and placement when folder deletion fails", async () => {
          const { store, folders, child, remove } = await setup();
          folders.removeFolders = async () => {
            throw new Error("Folder deletion failed");
          };
          expect((await remove()).status).toBe(500);
          expect(await store.load(ref)).not.toBeNull();
          expect((await folders.placements(scope)).get(ref.slug)).toBe(
            child.id,
          );
          expect(await folders.list(scope)).toHaveLength(2);
        });

        it("refuses to delete a revision changed after authorization", async () => {
          const { store, folders, remove } = await setup();
          const conditionalRemove = store.removeIfRevision!.bind(store);
          store.removeIfRevision = async (target, revision) => {
            await store.save(target, sampleConfig({ name: "Changed" }), {
              updatedBy: "owner",
              expectedRevision: revision,
            });
            return conditionalRemove(target, revision);
          };
          expect((await remove()).status).toBe(409);
          expect(await store.load(ref)).not.toBeNull();
          expect(await folders.list(scope)).toHaveLength(2);
        });

        it("rejects a stale folder set without deleting its new descendants", async () => {
          const { folders, parent } = await setup();
          await expect(
            folders.removeFolders(scope, [parent.id]),
          ).rejects.toMatchObject({ code: "CONFLICT" });
          expect(await folders.list(scope)).toHaveLength(2);
        });

        it("does not place absent dashboards and validates the folder first", async () => {
          const { folders, parent } = await setup();
          expect(await folders.placeDashboard(scope, "missing", null)).toBe(
            false,
          );
          expect(
            await folders.placeDashboard(scope, "missing", parent.id),
          ).toBe(false);
          await expect(
            folders.placeDashboard(scope, "missing", "missing"),
          ).rejects.toMatchObject({ code: "NOT_FOUND" });
          expect((await folders.placements(scope)).has("missing")).toBe(false);
        });

        it("keeps a new placement when deleting and recreating a slug in one transaction", async () => {
          const { store, folders, child } = await setup();
          await folders.transaction(scope, async () => {
            await store.remove(ref);
            await store.save(ref, sampleConfig({ name: "Recreated" }), {
              updatedBy: "owner",
            });
            expect(
              await folders.placeDashboard(scope, ref.slug, child.id),
            ).toBe(true);
          });
          expect((await folders.placements(scope)).get(ref.slug)).toBe(
            child.id,
          );
          expect((await store.load(ref))?.config).toMatchObject({
            name: "Recreated",
          });
        });
      },
    );
  },
);
