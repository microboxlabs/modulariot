import { beforeEach, describe, expect, it } from "vitest";
import type { QueryPlanContent, QueryPlanStore } from "../../seams/authoring";
import { createSqliteDriver } from "../sqlite-driver";
import { SQLITE_MEMORY } from "../sqlite";
import { runMigrations } from "./migrations";
import { createSqlQueryPlanStore } from "./query-plans";

let store: QueryPlanStore;

beforeEach(async () => {
  const driver = createSqliteDriver({ path: SQLITE_MEMORY });
  await runMigrations(driver);
  let id = 0;
  store = createSqlQueryPlanStore(driver, {
    newId: () => `id-${++id}`,
    now: () => new Date("2026-10-27T12:00:00Z"),
  });
});

const content: QueryPlanContent = {
  name: "Daily trips",
  projectId: "analytics-prod",
  location: "US",
  sql: "SELECT day FROM `fleet.daily` WHERE day >= @since",
  maximumBytesBilled: 5_000_000_000,
  parameters: [{ name: "since", type: "DATE", sample: "2026-10-01" }],
  columns: [{ name: "day", type: "DATE" }],
};

describe("the SQL query plan store", () => {
  it("round-trips a saved query", async () => {
    const saved = await store.create("acme", "warehouse", content, "ana");
    expect(saved).toEqual({
      ...content,
      id: "id-1",
      sourceId: "warehouse",
      revision: "id-2",
      updatedAt: "2026-10-27T12:00:00.000Z",
      updatedBy: "ana",
    });
    await expect(store.get("acme", "warehouse", "id-1")).resolves.toEqual(
      saved,
    );
    await expect(store.list("acme", "warehouse")).resolves.toEqual([saved]);
  });

  it("keeps tenants and sources apart", async () => {
    await store.create("acme", "warehouse", content, "ana");
    await expect(store.list("globex", "warehouse")).resolves.toEqual([]);
    await expect(store.list("acme", "lake")).resolves.toEqual([]);
    await expect(store.get("globex", "warehouse", "id-1")).resolves.toBeNull();
  });

  it("refuses a second query with the same name, ignoring case", async () => {
    await store.create("acme", "warehouse", content, "ana");
    await expect(
      store.create(
        "acme",
        "warehouse",
        { ...content, name: "DAILY TRIPS" },
        "ana",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      store.create("acme", "lake", content, "ana"),
    ).resolves.toMatchObject({ sourceId: "lake" });
  });

  it("replaces only the revision it was read at", async () => {
    const saved = await store.create("acme", "warehouse", content, "ana");
    const updated = await store.update(
      "acme",
      "warehouse",
      saved.id,
      { ...content, sql: "SELECT 1" },
      saved.revision,
      "luis",
    );
    expect(updated).toMatchObject({ sql: "SELECT 1", updatedBy: "luis" });
    expect(updated.revision).not.toBe(saved.revision);
    await expect(
      store.update(
        "acme",
        "warehouse",
        saved.id,
        content,
        saved.revision,
        "ana",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuses to rename a query to another one's name", async () => {
    await store.create("acme", "warehouse", content, "ana");
    const other = await store.create(
      "acme",
      "warehouse",
      { ...content, name: "Other" },
      "ana",
    );
    await expect(
      store.update(
        "acme",
        "warehouse",
        other.id,
        content,
        other.revision,
        "ana",
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("deletes", async () => {
    const saved = await store.create("acme", "warehouse", content, "ana");
    await store.remove("acme", "warehouse", saved.id);
    await expect(store.get("acme", "warehouse", saved.id)).resolves.toBeNull();
  });
});
