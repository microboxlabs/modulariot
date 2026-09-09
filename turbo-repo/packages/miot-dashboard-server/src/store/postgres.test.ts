/** Real PostgreSQL startup races; each test owns an isolated schema. */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openPostgresStore } from "./postgres";
import { createPostgresDriver } from "./postgres-driver";
import type { SqlDriver } from "./sql/driver";
import { MIGRATIONS, runMigrations } from "./sql/migrations";
import type { OpenedStore } from "./sql/open";

const postgresUrl = process.env.MIOT_DASHBOARD_TEST_POSTGRES_URL;

describe.skipIf(!postgresUrl)("PostgreSQL startup and recovery", () => {
  let admin: SqlDriver;
  let driver: SqlDriver;
  let schema: string;
  let url: string;
  const opened: OpenedStore[] = [];
  const poolErrors: Error[] = [];

  beforeEach(async () => {
    admin = createPostgresDriver({ url: postgresUrl! });
    schema = `miot_test_${randomUUID().replaceAll("-", "")}`;
    await admin.exec(`CREATE SCHEMA ${schema}`);
    const scoped = new URL(postgresUrl!);
    scoped.searchParams.set("options", `-c search_path=${schema}`);
    url = scoped.toString();
    poolErrors.length = 0;
    driver = createPostgresDriver({
      url,
      onPoolError: (error) => poolErrors.push(error),
    });
  });

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((store) => store.close()));
    await driver?.close();
    if (admin) {
      await admin.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.close();
    }
  });

  const start = async (documentBackend = "inline") => {
    const store = await openPostgresStore({ url, documentBackend });
    opened.push(store);
    return store;
  };

  it("reconnects after the database terminates an idle connection", async () => {
    const [connection] = await driver.all<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    );
    await admin.all("SELECT pg_terminate_backend($1)", [connection!.pid]);
    await vi.waitFor(() => expect(poolErrors).toHaveLength(1));
    const [replacement] = await driver.all<{ pid: number }>(
      "SELECT pg_backend_pid() AS pid",
    );
    expect(replacement!.pid).not.toBe(connection!.pid);
  });

  it("starts multiple servers on a fresh database", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => start()),
    );
    expect(results.map((result) => result.status)).toEqual(
      Array(8).fill("fulfilled"),
    );
    expect(opened.flatMap((store) => store.applied).sort()).toEqual(
      MIGRATIONS.map((migration) => migration.version),
    );
  });

  it("pins the same document backend when servers first open together", async () => {
    await runMigrations(driver);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => start()),
    );
    expect(results.map((result) => result.status)).toEqual(
      Array(8).fill("fulfilled"),
    );
    expect(await driver.all("SELECT value FROM store_settings")).toEqual([
      { value: "inline" },
    ]);
  });

  it("refuses competing document backends with the configuration error", async () => {
    await runMigrations(driver);
    const results = await Promise.allSettled([start("inline"), start("fs")]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason.message).toContain("document backend");
  });
});
