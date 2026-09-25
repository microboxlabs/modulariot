/**
 * The standalone server behind an authenticated proxy, over a real socket.
 *
 * Memberships are empty throughout. Every request that reaches a dashboard
 * does so on the asserted role alone, which is what makes these tests fail if
 * the assertion stops being read.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sampleConfig } from "../test/fixtures";
import {
  generateTestKeyPair,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import { createMemoryStore } from "../testing";
import {
  buildIdentityResolver,
  buildScopeAuthority,
  buildTenantAuthority,
} from "./auth";
import { readServerConfig, ConfigError, type AuthConfig } from "./config";
import { serve, type RunningServer } from "./serve";

const ISSUER = "https://issuer.test/";
const AUDIENCE = "miot-dashboards";
const JWKS_URL = "https://issuer.test/.well-known/jwks.json";
const PROXY_KEY = "k".repeat(32);

let pair: TestKeyPair;

beforeAll(async () => {
  pair = await generateTestKeyPair("test-key");
});

const fakeJwks = (): typeof fetch =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify({ keys: [pair.jwk] }), {
        headers: { "content-type": "application/json" },
      }),
    )) as unknown as typeof fetch;

const jwtAuth = (): AuthConfig => ({
  kind: "verified",
  jwt: {
    issuer: ISSUER,
    audience: [AUDIENCE],
    algorithm: "RS256",
    key: { kind: "jwks", url: JWKS_URL },
    claims: { userId: undefined, groups: undefined, displayName: undefined },
    clockToleranceSeconds: 30,
  },
  ticket: undefined,
});

const tokenFor = (sub = "auth0|ana"): Promise<string> =>
  signRs256(pair.privateKey, {
    header: { kid: pair.kid },
    claims: validClaims({ iss: ISSUER, aud: AUDIENCE, sub }),
  });

describe("the server behind an authenticated proxy", () => {
  let running: RunningServer;

  beforeAll(async () => {
    const options = { memberships: {}, proxyKey: PROXY_KEY };
    const { identity } = await buildIdentityResolver(jwtAuth(), {
      fetchImpl: fakeJwks(),
      proxyKey: PROXY_KEY,
    });
    running = await serve({
      identity,
      tenants: buildTenantAuthority({ kind: "seed" }, options).tenants,
      scopes: buildScopeAuthority({ kind: "seed" }, options).scopes,
      store: createMemoryStore(),
      port: 0,
      host: "127.0.0.1",
      docs: false,
      log: () => {},
    });
  });

  afterAll(async () => {
    await running.close();
  });

  const url = () => `${running.url}/tenants/acme/scopes/ops/dashboards/fleet`;

  const asserted = (token: string, overrides: Record<string, string> = {}) => ({
    authorization: `Bearer ${token}`,
    "x-miot-proxy-key": PROXY_KEY,
    "x-miot-asserted-user": "auth0|ana",
    "x-miot-asserted-tenant": "acme",
    "x-miot-asserted-scope": "ops",
    "x-miot-asserted-role": "Coordinator",
    ...overrides,
  });

  it("saves and reads back a dashboard on the asserted role alone", async () => {
    const token = await tokenFor();
    const saved = await fetch(url(), {
      method: "PUT",
      headers: { "content-type": "application/json", ...asserted(token) },
      body: JSON.stringify(sampleConfig()),
    });
    expect(saved.status).toBe(200);

    const read = await fetch(url(), { headers: asserted(token) });
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      data: { name: "Fleet" },
    });
  });

  it("refuses the same token with no assertion", async () => {
    const read = await fetch(url(), {
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });
    expect(read.status).toBe(403);
  });

  it("refuses an assertion naming a different tenant from the path", async () => {
    const read = await fetch(url(), {
      headers: asserted(await tokenFor(), {
        "x-miot-asserted-tenant": "globex",
      }),
    });
    expect(read.status).toBe(403);
  });

  it("refuses an assertion naming a different scope from the path", async () => {
    const read = await fetch(url(), {
      headers: asserted(await tokenFor(), {
        "x-miot-asserted-scope": "finance",
      }),
    });
    expect(read.status).toBe(403);
  });

  it("answers 500, not 403, when the proxy key is wrong", async () => {
    // A wrong key means the two deployments disagree about their shared
    // secret. Answering 403 would hide that among ordinary refusals.
    const read = await fetch(url(), {
      headers: asserted(await tokenFor(), {
        "x-miot-proxy-key": "n".repeat(32),
      }),
    });
    expect(read.status).toBe(500);
  });

  it("answers 500 when the assertion names someone else", async () => {
    const read = await fetch(url(), {
      headers: asserted(await tokenFor(), {
        "x-miot-asserted-user": "auth0|bob",
      }),
    });
    expect(read.status).toBe(500);
  });

  it("answers 401 for a request carrying nothing", async () => {
    const read = await fetch(url());
    expect(read.status).toBe(401);
  });

  it("answers 500 for an assertion with no bearer token behind it", async () => {
    const { authorization: _drop, ...headers } = asserted(await tokenFor());
    const read = await fetch(url(), { headers });
    expect(read.status).toBe(500);
  });
});

describe("readServerConfig and the proxy key", () => {
  const base = {
    MIOT_DASHBOARD_JWT_ISSUER: ISSUER,
    MIOT_DASHBOARD_JWT_AUDIENCE: AUDIENCE,
    MIOT_DASHBOARD_JWT_JWKS_URL: JWKS_URL,
  };

  it("is absent unless configured", () => {
    expect(readServerConfig(base).proxyKey).toBeUndefined();
  });

  it("is read when set", () => {
    expect(
      readServerConfig({ ...base, MIOT_DASHBOARD_PROXY_KEY: PROXY_KEY })
        .proxyKey,
    ).toBe(PROXY_KEY);
  });

  it("refuses a key short enough to guess", () => {
    expect(() =>
      readServerConfig({ ...base, MIOT_DASHBOARD_PROXY_KEY: "short" }),
    ).toThrow(ConfigError);
  });

  it("refuses to combine an assertion with unverified header auth", () => {
    expect(() =>
      readServerConfig({
        MIOT_DASHBOARD_INSECURE_AUTH: "true",
        MIOT_DASHBOARD_PROXY_KEY: PROXY_KEY,
      }),
    ).toThrow(ConfigError);
  });
});
