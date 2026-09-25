import { beforeEach, describe, expect, it } from "vitest";
import type { DataSourceStore } from "../../seams/datasources";
import { createSqliteDriver } from "../sqlite-driver";
import { SQLITE_MEMORY } from "../sqlite";
import { createSqlDataSourceStore } from "./datasources";
import { POSTGRES_DIALECT, type SqlDriver } from "./driver";
import { runMigrations } from "./migrations";

let store: DataSourceStore;

beforeEach(async () => {
  const driver = createSqliteDriver({ path: SQLITE_MEMORY });
  await runMigrations(driver);
  store = createSqlDataSourceStore(driver);
});

const pgrest = {
  name: "Fleet telemetry",
  type: "POSTGREST" as const,
  isActive: true,
  target: "https://pgrest.example.com",
  credentialRef: "fleet-token",
};

describe("the SQL datasource store", () => {
  it("round-trips a datasource", async () => {
    const written = await store.put("acme", "fleet", pgrest);

    expect(written).toMatchObject({
      id: "fleet",
      name: "Fleet telemetry",
      type: "POSTGREST",
      isActive: true,
      target: "https://pgrest.example.com",
      credentialRef: "fleet-token",
    });
    await expect(store.get("acme", "fleet")).resolves.toEqual(written);
  });

  it("keeps tenants apart", async () => {
    await store.put("acme", "fleet", pgrest);

    await expect(store.get("globex", "fleet")).resolves.toBeNull();
    await expect(store.list("globex")).resolves.toEqual([]);
  });

  it("replaces on a second write rather than duplicating", async () => {
    await store.put("acme", "fleet", pgrest);
    await store.put("acme", "fleet", { ...pgrest, name: "Renamed" });

    const rows = await store.list("acme");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe("Renamed");
  });

  it("stores a datasource with no credential", async () => {
    const written = await store.put("acme", "open", {
      name: "Public",
      type: "POSTGREST",
      isActive: false,
      target: "https://open.example.com",
    });

    expect(written.credentialRef).toBeUndefined();
    expect(written.description).toBeUndefined();
    expect(written.isActive).toBe(false);
  });

  it("drops a credential ref when a later write omits it", async () => {
    await store.put("acme", "fleet", pgrest);
    const rewritten = await store.put("acme", "fleet", {
      ...pgrest,
      credentialRef: undefined,
    });

    expect(rewritten.credentialRef).toBeUndefined();
    await expect(store.get("acme", "fleet")).resolves.toEqual(rewritten);
  });

  it("lists by name", async () => {
    await store.put("acme", "b", { ...pgrest, name: "Beta" });
    await store.put("acme", "a", { ...pgrest, name: "Alpha" });

    const names = (await store.list("acme")).map((row) => row.name);
    expect(names).toEqual(["Alpha", "Beta"]);
  });

  it("breaks a tie on the id", async () => {
    await store.put("acme", "b", { ...pgrest, name: "Same" });
    await store.put("acme", "a", { ...pgrest, name: "Same" });

    const ids = (await store.list("acme")).map((row) => row.id);
    expect(ids).toEqual(["a", "b"]);
  });

  /**
   * The test above passes either way: SQLite answers from the primary-key
   * index, so ties already come back in id order. PostgreSQL makes no such
   * promise, so this one asserts the statement instead of the rows.
   */
  it("asks the backend for the tie-break", async () => {
    const sql: string[] = [];
    const driver: SqlDriver = {
      dialect: POSTGRES_DIALECT,
      exec: () => Promise.resolve(),
      all: <T>(statement: string) => {
        sql.push(statement);
        return Promise.resolve([] as T[]);
      },
      transaction: <T>(body: () => Promise<T>) => body(),
      close: () => Promise.resolve(),
    };

    await createSqlDataSourceStore(driver).list("acme");

    expect(sql[0]).toMatch(/ORDER BY name, id/);
  });

  it("removes only the named row, and only in its tenant", async () => {
    await store.put("acme", "fleet", pgrest);
    await store.put("globex", "fleet", pgrest);

    await store.remove("acme", "fleet");

    await expect(store.get("acme", "fleet")).resolves.toBeNull();
    await expect(store.get("globex", "fleet")).resolves.not.toBeNull();
  });

  it("removing something absent is not an error", async () => {
    await expect(store.remove("acme", "missing")).resolves.toBeUndefined();
  });

  it("never stores a credential, only the handle to one", async () => {
    const driver = createSqliteDriver({ path: SQLITE_MEMORY });
    await runMigrations(driver);

    const columns = await driver.all<{ name: string }>(
      "SELECT name FROM pragma_table_info('datasources')",
    );

    // A secret cannot leak from a column that does not exist.
    expect(columns.map((column) => column.name)).toEqual([
      "tenant_id",
      "id",
      "name",
      "type",
      "description",
      "is_active",
      "target",
      "credential_ref",
      "updated_at",
    ]);
  });
});
