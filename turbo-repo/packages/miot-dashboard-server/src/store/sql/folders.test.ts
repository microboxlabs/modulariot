import { afterEach, describe, expect, it } from "vitest";
import { openSqliteStore, SQLITE_MEMORY, type OpenedStore } from "../sqlite";
import { createSqlFolderStore } from "./folders";

const scope = { tenantId: "acme", scopeId: "ops" };
const other = { tenantId: "globex", scopeId: "ops" };

let opened: OpenedStore | null = null;

afterEach(async () => {
  await opened?.close();
  opened = null;
});

async function setup() {
  opened = await openSqliteStore({ path: SQLITE_MEMORY });
  let counter = 0;
  const folders = createSqlFolderStore(opened.driver, {
    newId: () => `f${++counter}`,
  });
  const save = (slug: string) =>
    opened!.store.save(
      { ...scope, slug },
      { version: 2, name: slug },
      {
        updatedBy: "ana",
      },
    );
  return { folders, store: opened.store, save };
}

describe("SQL folder store", () => {
  it("creates nested folders and lists them per tenant", async () => {
    const { folders } = await setup();
    const ops = await folders.create(
      scope,
      { name: " Ops ", parentId: null },
      "ana",
    );
    await folders.create(scope, { name: "Daily", parentId: ops.id }, "ana");
    await folders.create(other, { name: "Theirs", parentId: null }, "bo");

    expect(ops).toEqual({
      id: "f1",
      name: "Ops",
      parentId: null,
      createdBy: "ana",
    });
    expect(await folders.list(scope)).toEqual([
      { id: "f2", name: "Daily", parentId: "f1", createdBy: "ana" },
      { id: "f1", name: "Ops", parentId: null, createdBy: "ana" },
    ]);
  });

  it("refuses a sibling name that is taken, ignoring case", async () => {
    const { folders } = await setup();
    const ops = await folders.create(
      scope,
      { name: "Ops", parentId: null },
      "ana",
    );
    await expect(
      folders.create(scope, { name: "ops", parentId: null }, "ana"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // The same name one level down is fine.
    await expect(
      folders.create(scope, { name: "Ops", parentId: ops.id }, "ana"),
    ).resolves.toMatchObject({ parentId: ops.id });
  });

  it("refuses a parent that does not exist", async () => {
    const { folders } = await setup();
    await expect(
      folders.create(scope, { name: "Ops", parentId: "nope" }, "ana"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("renames and moves, but never inside itself", async () => {
    const { folders } = await setup();
    const a = await folders.create(scope, { name: "A", parentId: null }, "ana");
    const b = await folders.create(scope, { name: "B", parentId: a.id }, "ana");

    await expect(
      folders.update(scope, a.id, { parentId: b.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      folders.update(scope, a.id, { parentId: a.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(
      await folders.update(scope, b.id, { name: "Bee", parentId: null }),
    ).toEqual({ id: b.id, name: "Bee", parentId: null, createdBy: "ana" });
    await expect(
      folders.update(scope, "nope", { name: "X" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("files dashboards without touching their revision", async () => {
    const { folders, store, save } = await setup();
    await save("fleet");
    const ops = await folders.create(
      scope,
      { name: "Ops", parentId: null },
      "ana",
    );

    expect(await folders.placeDashboard(scope, "fleet", ops.id)).toBe(true);
    expect(await folders.placements(scope)).toEqual(
      new Map([["fleet", ops.id]]),
    );
    expect((await store.load({ ...scope, slug: "fleet" }))?.revision).toBe(1);

    // Saving the dashboard again keeps it where it was filed.
    await opened!.store.save(
      { ...scope, slug: "fleet" },
      { version: 2, name: "Fleet 2" },
      { updatedBy: "ana", expectedRevision: 1 },
    );
    expect(await folders.placements(scope)).toEqual(
      new Map([["fleet", ops.id]]),
    );

    expect(await folders.placeDashboard(scope, "fleet", null)).toBe(true);
    expect(await folders.placements(scope)).toEqual(new Map());
    expect(await folders.placeDashboard(scope, "missing", null)).toBe(false);
    await expect(
      folders.placeDashboard(scope, "fleet", "nope"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("reads a subtree and removes it, sending stragglers to the top", async () => {
    const { folders, save } = await setup();
    await save("fleet");
    await save("sales");
    const a = await folders.create(scope, { name: "A", parentId: null }, "ana");
    const b = await folders.create(scope, { name: "B", parentId: a.id }, "ana");
    await folders.placeDashboard(scope, "fleet", b.id);

    expect(await folders.subtree(scope, a.id)).toEqual({
      folderIds: [a.id, b.id],
      slugs: ["fleet"],
    });
    expect(await folders.subtree(scope, "nope")).toBeNull();

    // Filed after the subtree was read: it must not point at a gone folder.
    await folders.placeDashboard(scope, "sales", b.id);
    await folders.removeFolders(scope, [a.id, b.id]);
    expect(await folders.list(scope)).toEqual([]);
    expect(await folders.placements(scope)).toEqual(new Map());
  });

  it("keeps a folder's permissions per tenant and drops them with it", async () => {
    const { folders } = await setup();
    const a = await folders.create(scope, { name: "A", parentId: null }, "ana");
    const theirs = await folders.create(
      other,
      { name: "A", parentId: null },
      "bo",
    );
    await folders.setPermissions(scope, a.id, [
      { authorityId: "lu", role: "Editor" },
      { authorityId: "team:7", role: "Consumer" },
    ]);
    await folders.setPermissions(other, theirs.id, [
      { authorityId: "bo", role: "Coordinator" },
    ]);
    expect(await folders.permissions(scope)).toEqual(
      new Map([
        [
          a.id,
          [
            { authorityId: "lu", role: "Editor" },
            { authorityId: "team:7", role: "Consumer" },
          ],
        ],
      ]),
    );

    // Replaced, not merged.
    await folders.setPermissions(scope, a.id, [
      { authorityId: "lu", role: "Coordinator" },
    ]);
    expect((await folders.permissions(scope)).get(a.id)).toEqual([
      { authorityId: "lu", role: "Coordinator" },
    ]);
    await expect(
      folders.setPermissions(scope, "nope", []),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await folders.removeFolders(scope, [a.id]);
    expect(await folders.permissions(scope)).toEqual(new Map());
    expect((await folders.permissions(other)).size).toBe(1);
  });

  it("rolls back permissions when the visibility write fails", async () => {
    const { folders } = await setup();
    const folder = await folders.create(
      scope,
      { name: "Private", parentId: null },
      "ana",
    );
    const previous = [{ authorityId: "ana", role: "Editor" as const }];
    await folders.setPermissions(scope, folder.id, previous, "restricted");
    const driver = opened!.driver;
    const failing = createSqlFolderStore({
      ...driver,
      all(sql, params) {
        if (sql.includes("SET visibility"))
          return Promise.reject(new Error("Visibility unavailable"));
        return driver.all(sql, params);
      },
    });
    await expect(
      failing.setPermissions(
        scope,
        folder.id,
        [{ authorityId: "bo", role: "Coordinator" }],
        "organization",
      ),
    ).rejects.toThrow("Visibility unavailable");
    expect((await folders.permissions(scope)).get(folder.id)).toEqual(previous);
    expect((await folders.list(scope))[0]?.visibility).toBe("restricted");
  });

  it("keeps who sees a folder, per tenant, the whole scope by default", async () => {
    const { folders } = await setup();
    const a = await folders.create(scope, { name: "A", parentId: null }, "ana");
    const theirs = await folders.create(
      other,
      { name: "A", parentId: null },
      "bo",
    );
    expect((await folders.list(scope))[0]?.visibility).toBeUndefined();
    const kept = await folders.create(
      scope,
      { name: "B", parentId: null, visibility: "restricted" },
      "ana",
    );
    expect(kept.visibility).toBe("restricted");
    expect(
      (await folders.list(scope)).find((f) => f.id === kept.id)?.visibility,
    ).toBe("restricted");
    await folders.setVisibility(scope, a.id, "restricted");
    expect(
      (await folders.list(scope)).find((f) => f.id === a.id)?.visibility,
    ).toBe("restricted");
    expect((await folders.list(other))[0]?.visibility).toBeUndefined();
    await folders.setVisibility(scope, a.id, "organization");
    expect(
      (await folders.list(scope)).find((f) => f.id === a.id)?.visibility,
    ).toBeUndefined();
    await expect(
      folders.setVisibility(other, a.id, "restricted"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(theirs.visibility).toBeUndefined();
  });
});
