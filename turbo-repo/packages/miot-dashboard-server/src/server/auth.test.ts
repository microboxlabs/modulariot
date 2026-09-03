/**
 * Assembling the identity resolver from configuration, and then running the
 * whole server behind it over a real socket.
 *
 * The unit tests below the HTTP ones prove the pieces; the HTTP ones prove
 * that a bearer token actually reaches a dashboard and that a bad one gets a
 * 401 envelope rather than a stack trace.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateTestKeyPair,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import { createMemoryScopeAuthority, createMemoryStore } from "../testing";
import { buildIdentityResolver } from "./auth";
import { ConfigError, type JwtAuthConfig } from "./config";
import { serve, type RunningServer } from "./serve";

const ISSUER = "https://issuer.test/";
const AUDIENCE = "miot-dashboards";
const TENANT_CLAIM = "https://miot.dev/tenant_id";
const JWKS_URL = "https://issuer.test/.well-known/jwks.json";

let pair: TestKeyPair;

beforeAll(() => {
  pair = generateTestKeyPair("test-key");
});

/** Answers the JWKS URL from the in-process key pair. */
const fakeJwks = (): typeof fetch =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify({ keys: [pair.jwk] }), {
        headers: { "content-type": "application/json" },
      }),
    )) as unknown as typeof fetch;

const jwtConfig = (overrides: Partial<JwtAuthConfig> = {}): JwtAuthConfig => ({
  kind: "jwt",
  issuer: ISSUER,
  audience: [AUDIENCE],
  algorithm: "RS256",
  key: { kind: "jwks", url: JWKS_URL },
  claims: {
    tenantId: TENANT_CLAIM,
    userId: undefined,
    groups: undefined,
    displayName: undefined,
  },
  clockToleranceSeconds: 30,
  ...overrides,
});

const tokenFor = (claims: Record<string, unknown> = {}): string =>
  signRs256(pair.privateKey, {
    header: { kid: pair.kid },
    claims: validClaims({
      iss: ISSUER,
      aud: AUDIENCE,
      sub: "auth0|ana",
      [TENANT_CLAIM]: "acme",
      ...claims,
    }),
  });

describe("buildIdentityResolver", () => {
  it("builds a resolver that verifies against the JWKS endpoint", async () => {
    const { identity } = buildIdentityResolver(jwtConfig(), {
      fetchImpl: fakeJwks(),
    });
    const request = new Request("https://server.test/", {
      headers: { authorization: `Bearer ${tokenFor()}` },
    });

    await expect(identity.resolve(request)).resolves.toMatchObject({
      userId: "auth0|ana",
      tenantId: "acme",
    });
  });

  it("describes the configuration without printing key material", () => {
    const { describe: line } = buildIdentityResolver(
      jwtConfig({
        algorithm: "HS256",
        key: { kind: "secret", secret: "s".repeat(40) },
      }),
    );

    expect(line).toContain("HS256");
    expect(line).toContain(ISSUER);
    expect(line).not.toContain("s".repeat(40));
  });

  it("turns an unusable key into a startup failure", () => {
    // The alternative is a process that starts, looks healthy and refuses
    // every request.
    expect(() =>
      buildIdentityResolver(
        jwtConfig({
          algorithm: "HS256",
          key: { kind: "secret", secret: "too-short" },
        }),
      ),
    ).toThrow(ConfigError);

    expect(() =>
      buildIdentityResolver(
        jwtConfig({ key: { kind: "publicKey", pem: "not a pem" } }),
      ),
    ).toThrow(ConfigError);
  });

  it("still builds the header resolver when that is what was asked for", async () => {
    const { identity, describe: line } = buildIdentityResolver({
      kind: "insecure",
    });
    expect(line).toContain("unverified");

    const request = new Request("https://server.test/", {
      headers: { "x-dev-user": "ana", "x-dev-tenant": "acme" },
    });
    await expect(identity.resolve(request)).resolves.toMatchObject({
      userId: "ana",
    });
  });
});

describe("the server behind a verifying resolver", () => {
  let running: RunningServer;

  beforeAll(async () => {
    const { identity } = buildIdentityResolver(jwtConfig(), {
      fetchImpl: fakeJwks(),
    });
    running = await serve({
      identity,
      scopes: createMemoryScopeAuthority({
        acme: { ops: { "auth0|ana": "Coordinator" } },
      }),
      store: createMemoryStore(),
      port: 0,
      // Binding off loopback is legitimate now that tokens are verified; the
      // test still uses loopback so it does not open a port on the network.
      host: "127.0.0.1",
      docs: false,
      log: () => {},
    });
  });

  afterAll(async () => {
    await running.close();
  });

  const dashboardUrl = () => `${running.url}/scopes/ops/dashboards/fleet`;

  const put = (token: string | null) =>
    fetch(dashboardUrl(), {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ version: 2, name: "Fleet", widgets: [] }),
    });

  it("saves and reads back a dashboard for a bearer token", async () => {
    const token = tokenFor();
    const saved = await put(token);
    expect(saved.status).toBe(200);

    const read = await fetch(dashboardUrl(), {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      data: { name: "Fleet" },
    });
  });

  it("answers 401 with no credential", async () => {
    const response = await put(null);
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it.each([
    ["an expired token", { exp: 1_600_000_000 }],
    ["a token for another API", { aud: "another-api" }],
    ["a token from another issuer", { iss: "https://elsewhere.test/" }],
    ["a token carrying no tenant", { [TENANT_CLAIM]: undefined }],
  ])("answers 401 for %s", async (_name, claims) => {
    const response = await put(tokenFor(claims));
    expect(response.status).toBe(401);
  });

  it("refuses a token signed by a key this server does not trust", async () => {
    const attacker = generateTestKeyPair("test-key");
    const forged = signRs256(attacker.privateKey, {
      header: { kid: "test-key" },
      claims: validClaims({
        iss: ISSUER,
        aud: AUDIENCE,
        sub: "auth0|attacker",
        [TENANT_CLAIM]: "acme",
      }),
    });

    expect((await put(forged)).status).toBe(401);
  });

  it("keeps a caller inside the tenant their token names", async () => {
    // The header is the one the insecure resolver would have believed.
    const response = await fetch(dashboardUrl(), {
      headers: {
        authorization: `Bearer ${tokenFor({ [TENANT_CLAIM]: "other-tenant" })}`,
        "x-dev-tenant": "acme",
      },
    });
    // Another tenant's caller has no standing in this scope, and the answer
    // must not distinguish that from the scope not existing.
    expect(response.status).toBe(403);
  });
});
