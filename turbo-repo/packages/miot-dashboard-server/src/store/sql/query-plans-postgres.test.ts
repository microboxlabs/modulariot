import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPostgresDriver } from "../postgres-driver";
import type { SqlDriver } from "./driver";
import { runMigrations } from "./migrations";
import { createSqlQueryPlanStore } from "./query-plans";
import type { QueryPlanContent } from "../../seams/authoring";

const postgresUrl = process.env.MIOT_DASHBOARD_TEST_POSTGRES_URL;
const content: QueryPlanContent = {
  name: "Demo",
  projectId: "demo-project",
  location: "US",
  sql: "SELECT 1",
  maximumBytesBilled: 1000,
  parameters: [],
};

describe.skipIf(!postgresUrl)("PostgreSQL query-name races", () => {
  let admin: SqlDriver;
  let driver: SqlDriver;
  let schema: string;
  beforeEach(async () => {
    admin = createPostgresDriver({ url: postgresUrl! });
    schema = `query_test_${randomUUID().replaceAll("-", "")}`;
    await admin.exec(`CREATE SCHEMA ${schema}`);
    const url = new URL(postgresUrl!);
    url.searchParams.set("options", `-c search_path=${schema}`);
    driver = createPostgresDriver({ url: url.toString() });
    await runMigrations(driver);
  });
  afterEach(async () => {
    await driver?.close();
    if (admin) {
      await admin.exec(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.close();
    }
  });

  function racingStore() {
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const coordinated: SqlDriver = {
      ...driver,
      async all<T>(sql: string, params = []) {
        const rows = await driver.all<T>(sql, params);
        if (
          sql.trimStart().startsWith("SELECT id FROM query_plans") &&
          params[2] === "shared"
        ) {
          if (++arrivals === 2) release();
          await barrier;
        }
        return rows;
      },
    };
    return createSqlQueryPlanStore(coordinated);
  }

  function expectOneConflict(results: PromiseSettledResult<unknown>[]) {
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "CONFLICT",
    });
  }

  it("returns CONFLICT after concurrent creates pass the initial name lookup", async () => {
    const store = racingStore();
    expectOneConflict(
      await Promise.allSettled([
        store.create(
          "demo",
          "source",
          { ...content, name: "Shared" },
          "demo-user",
        ),
        store.create(
          "demo",
          "source",
          { ...content, name: "SHARED" },
          "demo-user",
        ),
      ]),
    );
  });
  it("returns CONFLICT after concurrent renames of different plans pass the lookup", async () => {
    const store = racingStore();
    const a = await store.create(
      "demo",
      "source",
      { ...content, name: "First" },
      "demo-user",
    );
    const b = await store.create(
      "demo",
      "source",
      { ...content, name: "Second" },
      "demo-user",
    );
    expectOneConflict(
      await Promise.allSettled([
        store.update(
          "demo",
          "source",
          a.id,
          { ...content, name: "Shared" },
          a.revision,
          "demo-user",
        ),
        store.update(
          "demo",
          "source",
          b.id,
          { ...content, name: "SHARED" },
          b.revision,
          "demo-user",
        ),
      ]),
    );
  });
});
