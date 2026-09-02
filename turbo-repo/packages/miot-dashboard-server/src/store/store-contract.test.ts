/**
 * The `ServerDashboardStore` contract, run against every implementation we ship.
 *
 * The in-memory store is what our tests, the dev server and an integrator's
 * first afternoon run on, so anything it does that a database does not is a
 * lesson people learn wrong. Backend-specific behaviour goes in `sqlite.test.ts`.
 */

import { afterEach, describe, expect, it } from "vitest";
import { DashboardServerError } from "../access/errors";
import type { ServerDashboardStore } from "../seams/store";
import { createMemoryStore } from "../testing";
import { openSqliteStore, SQLITE_MEMORY } from "./sqlite";

interface Opened {
  store: ServerDashboardStore;
  close(): Promise<void>;
}

const BACKENDS = [
  {
    name: "in-memory",
    open: (): Promise<Opened> =>
      Promise.resolve({
        store: createMemoryStore(),
        close: () => Promise.resolve(),
      }),
  },
  {
    name: "sqlite + inline documents",
    open: async (): Promise<Opened> => {
      const opened = await openSqliteStore({ path: SQLITE_MEMORY });
      return { store: opened.store, close: opened.close };
    },
  },
];

const ref = { tenantId: "acme", scopeId: "ops", slug: "fleet" };
const other = { tenantId: "acme", scopeId: "ops", slug: "spares" };
const config = { version: 2, name: "Fleet", widgets: [] };

describe.each(BACKENDS)("$name", ({ open }) => {
  let opened: Opened;
  const store = async (): Promise<ServerDashboardStore> => {
    opened = await open();
    return opened.store;
  };

  afterEach(async () => {
    await opened?.close();
  });

  it("has nothing before anything is written", async () => {
    const s = await store();
    expect(await s.load(ref)).toBeNull();
    expect(await s.list(ref.tenantId, ref.scopeId)).toEqual([]);
  });

  it("creates at revision 1 and records who did it", async () => {
    const s = await store();
    const saved = await s.save(ref, config, { updatedBy: "ana" });
    expect(saved.revision).toBe(1);
    expect(saved.updatedBy).toBe("ana");
    expect(saved.createdBy).toBe("ana");
    expect(saved.config).toEqual(config);
  });

  it("round-trips the config it was handed, untouched", async () => {
    const s = await store();
    // A key order a JSON column type would be free to rewrite.
    const awkward = {
      version: 2,
      name: "Ünïcode ✅",
      zeta: null,
      widgets: [{ id: "w1", config: { nested: { deep: [1, 2, 3] } } }],
      alpha: 1,
    };
    await s.save(ref, awkward, { updatedBy: "ana" });
    expect((await s.load(ref))?.config).toEqual(awkward);
  });

  it("bumps the revision on every write with no precondition", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    const second = await s.save(ref, config, { updatedBy: "ana" });
    expect(second.revision).toBe(2);
  });

  it("accepts the revision the caller expected", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    const second = await s.save(ref, config, {
      updatedBy: "ana",
      expectedRevision: 1,
    });
    expect(second.revision).toBe(2);
  });

  it("refuses a stale revision with a conflict", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.save(ref, config, { updatedBy: "bo" });
    await expect(
      s.save(ref, config, { updatedBy: "ana", expectedRevision: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("treats revision 0 as 'this does not exist yet'", async () => {
    const s = await store();
    const created = await s.save(ref, config, {
      updatedBy: "ana",
      expectedRevision: 0,
    });
    expect(created.revision).toBe(1);
    await expect(
      s.save(ref, config, { updatedBy: "bo", expectedRevision: 0 }),
    ).rejects.toBeInstanceOf(DashboardServerError);
  });

  it("keeps createdBy across writes by other people", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    const second = await s.save(ref, config, { updatedBy: "bo" });
    expect(second.createdBy).toBe("ana");
    expect(second.updatedBy).toBe("bo");
  });

  it("lists a scope by the name in the config, falling back to the slug", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.save(other, { version: 2 }, { updatedBy: "ana" });
    expect(await s.list(ref.tenantId, ref.scopeId)).toEqual(
      expect.arrayContaining([
        { slug: "fleet", name: "Fleet" },
        { slug: "spares", name: "spares" },
      ]),
    );
  });

  it("shows a rename in the list", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.save(ref, { ...config, name: "Fleet 2026" }, { updatedBy: "ana" });
    expect(await s.list(ref.tenantId, ref.scopeId)).toEqual([
      { slug: "fleet", name: "Fleet 2026" },
    ]);
  });

  it("never lets one tenant see another's identically named scope", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.save(
      { ...ref, tenantId: "globex" },
      { version: 2, name: "Theirs" },
      { updatedBy: "bo" },
    );
    expect(await s.list("acme", "ops")).toEqual([
      { slug: "fleet", name: "Fleet" },
    ]);
    expect(await s.list("globex", "ops")).toEqual([
      { slug: "fleet", name: "Theirs" },
    ]);
  });

  it("removes a dashboard from both load and list", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.remove(ref);
    expect(await s.load(ref)).toBeNull();
    expect(await s.list(ref.tenantId, ref.scopeId)).toEqual([]);
  });

  it("removes something that was never there without complaining", async () => {
    const s = await store();
    await expect(s.remove(ref)).resolves.toBeUndefined();
  });

  it("starts a dashboard with no permission assignments", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    expect(await s.getPermissions(ref)).toEqual([]);
  });

  it("replaces permission assignments rather than adding to them", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.setPermissions(ref, [
      { authorityId: "GROUP_ops", role: "Editor" },
      { authorityId: "bo", role: "Consumer" },
    ]);
    expect(await s.getPermissions(ref)).toEqual(
      expect.arrayContaining([
        { authorityId: "GROUP_ops", role: "Editor" },
        { authorityId: "bo", role: "Consumer" },
      ]),
    );

    await s.setPermissions(ref, [{ authorityId: "bo", role: "Coordinator" }]);
    expect(await s.getPermissions(ref)).toEqual([
      { authorityId: "bo", role: "Coordinator" },
    ]);
  });

  it("keeps one dashboard's permissions out of another's", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.save(other, config, { updatedBy: "ana" });
    await s.setPermissions(ref, [{ authorityId: "bo", role: "Consumer" }]);
    expect(await s.getPermissions(other)).toEqual([]);
  });

  it("hands back a record the caller cannot use to rewrite history", async () => {
    const s = await store();
    const saved = await s.save(ref, config, { updatedBy: "ana" });
    saved.revision = 99;
    expect((await s.load(ref))?.revision).toBe(1);
  });

  it("hands back a permission list the caller cannot append to", async () => {
    const s = await store();
    await s.save(ref, config, { updatedBy: "ana" });
    await s.setPermissions(ref, [{ authorityId: "bo", role: "Consumer" }]);
    const assignments = await s.getPermissions(ref);
    assignments.push({ authorityId: "mallory", role: "Coordinator" });
    expect(await s.getPermissions(ref)).toEqual([
      { authorityId: "bo", role: "Consumer" },
    ]);
  });
});
