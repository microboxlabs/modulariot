/**
 * The wiring between the datasource routes and `MIOT_DASHBOARD_STORE` and
 * `MIOT_DASHBOARD_CREDENTIALS_KEY`. A mistake here answers 404 for the whole
 * feature while every store below it passes. The routes themselves are
 * covered elsewhere.
 */

import { describe, expect, it } from "vitest";
import { createDashboardHandler } from "../http/handler";
import { isCredentialsStore } from "../seams/credentials";
import { openSqliteStore, SQLITE_MEMORY } from "../store/sqlite";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  createMemoryTenantAuthority,
  createMemoryStore,
  type Memberships,
} from "../testing";
import { readServerConfig } from "./config";
import { openDataSources } from "./open-datasources";

const KEY = "0123456789abcdef0123456789abcdef";

const MEMBERSHIPS: Memberships = {
  acme: { ops: { alice: "Coordinator" } },
};

/** A migrated database, as the standalone server hands one over. */
const database = async () => {
  const opened = await openSqliteStore({ path: SQLITE_MEMORY });
  return opened.driver;
};

const env = (extra: Record<string, string> = {}) =>
  readServerConfig({
    MIOT_DASHBOARD_INSECURE_AUTH: "true",
    MIOT_DASHBOARD_STORE: "sqlite",
    ...extra,
  });

/** A GET as a Coordinator. 404 where the routes are not mounted. */
async function status(
  path: string,
  opened: Awaited<ReturnType<typeof openDataSources>>,
): Promise<number> {
  const handler = createDashboardHandler({
    identity: createInsecureHeaderIdentityResolver(),
    tenants: createMemoryTenantAuthority(MEMBERSHIPS),
    scopes: createMemoryScopeAuthority(MEMBERSHIPS),
    store: createMemoryStore(),
    ...(opened.dataSources ? { dataSources: opened.dataSources } : {}),
    ...(opened.credentials ? { credentials: opened.credentials } : {}),
  });
  const response = await handler(
    new Request(`http://test.local/tenants/acme/scopes/ops/${path}`, {
      headers: { "x-dev-user": "alice" },
    }),
  );
  return response.status;
}

describe("what a deployment mounts", () => {
  it("serves neither without a database", async () => {
    const opened = await openDataSources(
      env({ MIOT_DASHBOARD_STORE: "memory" }),
      undefined,
    );

    expect(opened.dataSources).toBeUndefined();
    expect(opened.credentials).toBeUndefined();
    expect(await status("datasources", opened)).toBe(404);
    expect(await status("credentials", opened)).toBe(404);
  });

  it("serves datasources and no credentials without a key", async () => {
    const opened = await openDataSources(env(), await database());

    expect(opened.dataSources).toBeDefined();
    expect(opened.credentials).toBeUndefined();
    expect(await status("datasources", opened)).toBe(200);
    expect(await status("credentials", opened)).toBe(404);
  });

  it("serves both with a key, on the one database", async () => {
    const driver = await database();
    const opened = await openDataSources(
      env({ MIOT_DASHBOARD_CREDENTIALS_KEY: KEY }),
      driver,
    );

    expect(await status("datasources", opened)).toBe(200);
    expect(await status("credentials", opened)).toBe(200);

    const vault = opened.credentials;
    if (vault === undefined || !isCredentialsStore(vault)) {
      throw new Error("expected a writable vault");
    }
    await vault.putCredential("acme", "fleet", {
      kind: "BEARER",
      token: "pgrst_live_0123456789abcdef",
    });

    // The same driver the datasource store was built on.
    const rows = await driver.all<{ ref: string }>(
      "SELECT ref FROM datasource_credentials",
    );
    expect(rows.map((row) => row.ref)).toEqual(["fleet"]);
  });

  it("refuses a key the memory store would throw away", () => {
    expect(() =>
      env({
        MIOT_DASHBOARD_STORE: "memory",
        MIOT_DASHBOARD_CREDENTIALS_KEY: KEY,
      }),
    ).toThrow(/needs a database/);
  });

  it("refuses a key under the minimum length", () => {
    expect(() => env({ MIOT_DASHBOARD_CREDENTIALS_KEY: "short" })).toThrow(
      /MIOT_DASHBOARD_CREDENTIALS_KEY is 5 characters/,
    );
  });

  it("reads an absent or empty key as off", () => {
    expect(env().credentialsKey).toBeUndefined();
    expect(
      env({ MIOT_DASHBOARD_CREDENTIALS_KEY: "" }).credentialsKey,
    ).toBeUndefined();
  });
});
