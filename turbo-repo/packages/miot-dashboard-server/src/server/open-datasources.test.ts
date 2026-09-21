/**
 * The wiring between the datasource routes and `MIOT_DASHBOARD_STORE`,
 * `MIOT_DASHBOARD_CREDENTIALS_KEY` and `MIOT_DASHBOARD_CREDENTIALS_URL`. A
 * mistake here answers 404 for the whole feature while every store below it
 * passes. The routes themselves are covered elsewhere.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
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

const PROXY_KEY = "proxy-0123456789abcdef0123456789abcdef";
const ENDPOINT =
  "https://host.internal/tenants/{tenantId}/credentials/{credentialRef}";

/**
 * The proxy key is refused alongside unverified header identity, and the
 * credential endpoint authenticates with that key, so asking the host for
 * credentials means a real identity provider.
 */
const verified = (extra: Record<string, string> = {}) =>
  readServerConfig({
    MIOT_DASHBOARD_STORE: "sqlite",
    MIOT_DASHBOARD_JWT_ISSUER: "https://issuer.test/",
    MIOT_DASHBOARD_JWT_AUDIENCE: "dashboards",
    MIOT_DASHBOARD_JWT_SECRET: "0123456789abcdef0123456789abcdef",
    MIOT_DASHBOARD_PROXY_KEY: PROXY_KEY,
    ...extra,
  });

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(env().credentials.kind).toBe("none");
    expect(env({ MIOT_DASHBOARD_CREDENTIALS_KEY: "" }).credentials.kind).toBe(
      "none",
    );
  });
});

describe("credentials the host owns", () => {
  it("mounts a read-only vault, so nothing is stored here", async () => {
    const opened = await openDataSources(
      verified({ MIOT_DASHBOARD_CREDENTIALS_URL: ENDPOINT }),
      await database(),
    );

    expect(opened.credentials).toBeDefined();
    expect(isCredentialsStore(opened.credentials!)).toBe(false);
    expect(await status("datasources", opened)).toBe(200);
    // The routes that write a credential are not served at all.
    expect(await status("credentials", opened)).toBe(404);
  });

  it("names the host but not the path it asks about", async () => {
    const opened = await openDataSources(
      verified({ MIOT_DASHBOARD_CREDENTIALS_URL: ENDPOINT }),
      await database(),
    );

    expect(opened.describe).toBe(
      "datasources on, credentials from https://host.internal",
    );
    expect(opened.describe).not.toContain("tenantId");
  });

  it("asks the endpoint with the shared key and takes the applied auth", async () => {
    const calls: Array<{ url: string; key: string | null }> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
      const headers = new Headers(init?.headers);
      calls.push({
        url: String(input),
        key: headers.get("x-miot-proxy-key"),
      });
      return Promise.resolve(
        Response.json({
          kind: "HTTP_AUTH",
          headers: { Authorization: "Bearer resolved-by-the-host" },
        }),
      );
    });

    const opened = await openDataSources(
      verified({ MIOT_DASHBOARD_CREDENTIALS_URL: ENDPOINT }),
      await database(),
    );
    const credential = await opened.credentials!.resolve("acme", "fleet");

    expect(calls).toEqual([
      {
        url: "https://host.internal/tenants/acme/credentials/fleet",
        key: PROXY_KEY,
      },
    ]);
    expect(credential).toEqual({
      kind: "HTTP_AUTH",
      headers: { Authorization: "Bearer resolved-by-the-host" },
      queryParams: {},
    });
  });

  it("refuses a URL and a key together", () => {
    expect(() =>
      verified({
        MIOT_DASHBOARD_CREDENTIALS_URL: ENDPOINT,
        MIOT_DASHBOARD_CREDENTIALS_KEY: KEY,
      }),
    ).toThrow(/different owners for the same secret/);
  });

  it("refuses a URL with no key to identify this server", () => {
    expect(() =>
      verified({
        MIOT_DASHBOARD_CREDENTIALS_URL: ENDPOINT,
        MIOT_DASHBOARD_PROXY_KEY: "",
      }),
    ).toThrow(/needs MIOT_DASHBOARD_PROXY_KEY/);
  });

  it("refuses a URL that would read one credential for every tenant", async () => {
    await expect(
      openDataSources(
        verified({
          MIOT_DASHBOARD_CREDENTIALS_URL:
            "https://host.internal/credentials/{credentialRef}",
        }),
        await database(),
      ),
      // A ConfigError, so it exits the way a bad setting does.
    ).rejects.toThrow(/different credential for each \{tenantId\}/);
  });
});
