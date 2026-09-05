/**
 * Assembling the identity resolver from configuration, and running the server
 * behind it over a real socket.
 *
 * The HTTP tests check that a bearer token reaches a dashboard and that a bad
 * one produces a 401 envelope rather than a stack trace.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  generateTestKeyPair,
  signRs256,
  validClaims,
  type TestKeyPair,
} from "../test/tokens";
import { FULL_CAPABILITIES } from "../access/roles";
import { createMemoryScopeAuthority, createMemoryStore } from "../testing";
import { buildIdentityResolver, buildScopeAuthority } from "./auth";
import {
  ConfigError,
  type AuthConfig,
  type JwtAuthConfig,
  type TicketAuthConfig,
} from "./config";
import { serve, type RunningServer } from "./serve";

const ISSUER = "https://issuer.test/";
const AUDIENCE = "miot-dashboards";
const TENANT_CLAIM = "https://miot.dev/tenant_id";
const JWKS_URL = "https://issuer.test/.well-known/jwks.json";

let pair: TestKeyPair;

beforeAll(async () => {
  pair = await generateTestKeyPair("test-key");
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

/** JWT-only verified auth, which is what most of these tests exercise. */
const jwtAuth = (overrides: Partial<JwtAuthConfig> = {}): AuthConfig => ({
  kind: "verified",
  jwt: jwtConfig(overrides),
  ticket: undefined,
});

const tokenFor = (claims: Record<string, unknown> = {}): Promise<string> =>
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
    const { identity } = await buildIdentityResolver(jwtAuth(), {
      fetchImpl: fakeJwks(),
    });
    const request = new Request("https://server.test/", {
      headers: { authorization: `Bearer ${await tokenFor()}` },
    });

    await expect(identity.resolve(request)).resolves.toMatchObject({
      userId: "auth0|ana",
      tenantId: "acme",
    });
  });

  it("describes the configuration without printing key material", async () => {
    const { describe: line } = await buildIdentityResolver(
      jwtAuth({
        algorithm: "HS256",
        key: { kind: "secret", secret: "s".repeat(40) },
      }),
    );

    expect(line).toContain("HS256");
    expect(line).toContain(ISSUER);
    expect(line).not.toContain("s".repeat(40));
  });

  it("turns an unusable key into a startup failure", async () => {
    // Otherwise the process starts, reports itself healthy, and refuses
    // every request.
    await expect(
      buildIdentityResolver(
        jwtAuth({
          algorithm: "HS256",
          key: { kind: "secret", secret: "too-short" },
        }),
      ),
    ).rejects.toThrow(ConfigError);

    await expect(
      buildIdentityResolver(
        jwtAuth({ key: { kind: "publicKey", pem: "not a pem" } }),
      ),
    ).rejects.toThrow(ConfigError);
  });

  it("still builds the header resolver when that is what was asked for", async () => {
    const { identity, describe: line } = await buildIdentityResolver({
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
    const { identity } = await buildIdentityResolver(jwtAuth(), {
      fetchImpl: fakeJwks(),
    });
    running = await serve({
      identity,
      scopes: createMemoryScopeAuthority({
        acme: { ops: { "auth0|ana": "Coordinator" } },
      }),
      store: createMemoryStore(),
      port: 0,
      // Binding off loopback is allowed now that tokens are verified. The
      // test uses loopback so it opens no port on the network.
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
    const token = await tokenFor();
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
    const response = await put(await tokenFor(claims));
    expect(response.status).toBe(401);
  });

  it("refuses a token signed by a key this server does not trust", async () => {
    const attacker = await generateTestKeyPair("test-key");
    const forged = await signRs256(attacker.privateKey, {
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
        authorization: `Bearer ${await tokenFor({ [TENANT_CLAIM]: "other-tenant" })}`,
        "x-dev-tenant": "acme",
      },
    });
    // A caller from another tenant has no standing in this scope, and the
    // answer must not distinguish that from the scope not existing.
    expect(response.status).toBe(403);
  });
});

// ---------------------------------------------------------------- tickets ----

const TICKET_URL = "https://emitter.test/tickets/-me-";

const ticketConfig = (
  overrides: Partial<TicketAuthConfig> = {},
): TicketAuthConfig => ({
  header: "x-ticket",
  scheme: undefined,
  url: TICKET_URL,
  method: "GET",
  present: {
    kind: "header",
    name: "authorization",
    value: "Basic {ticketBase64}",
  },
  serviceHeader: undefined,
  tenant: { kind: "fixed", tenantId: "acme" },
  claims: { userId: "entry.id", groups: undefined, displayName: undefined },
  absentStatuses: [401, 404],
  cacheSeconds: 60,
  negativeCacheSeconds: 30,
  requestTimeoutMs: 5000,
  ...overrides,
});

const emitterAnswering = (status: number, body: unknown = {}): typeof fetch =>
  (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    )) as unknown as typeof fetch;

describe("buildIdentityResolver: tickets", () => {
  it("builds a resolver that validates against the emitter", async () => {
    const { identity, describe: line } = await buildIdentityResolver(
      { kind: "verified", jwt: undefined, ticket: ticketConfig() },
      { fetchImpl: emitterAnswering(200, { entry: { id: "ana" } }) },
    );

    expect(line).toContain(TICKET_URL);
    await expect(
      identity.resolve(
        new Request("https://server.test/", {
          headers: { "x-ticket": "TICKET_1" },
        }),
      ),
    ).resolves.toMatchObject({ userId: "ana", tenantId: "acme" });
  });

  it("never puts the service credential in the startup line", async () => {
    const { describe: line } = await buildIdentityResolver(
      {
        kind: "verified",
        jwt: undefined,
        ticket: ticketConfig({
          serviceHeader: { name: "x-api-key", value: "SUPER_SECRET" },
        }),
      },
      { fetchImpl: emitterAnswering(200, { entry: { id: "ana" } }) },
    );
    expect(line).not.toContain("SUPER_SECRET");
  });

  it("reports a validation URL that is not https as a configuration error", async () => {
    await expect(
      buildIdentityResolver({
        kind: "verified",
        jwt: undefined,
        ticket: ticketConfig({ url: "http://emitter.test/x" }),
      }),
    ).rejects.toThrowError(ConfigError);
  });

  it("accepts a token or a ticket when both are configured", async () => {
    // The two read different headers, so neither shadows the other.
    const both = await buildIdentityResolver(
      { kind: "verified", jwt: jwtConfig(), ticket: ticketConfig() },
      {
        fetchImpl: ((input: unknown) =>
          String(input).startsWith(TICKET_URL)
            ? Promise.resolve(
                new Response(JSON.stringify({ entry: { id: "tina" } }), {
                  headers: { "content-type": "application/json" },
                }),
              )
            : Promise.resolve(
                new Response(JSON.stringify({ keys: [pair.jwk] }), {
                  headers: { "content-type": "application/json" },
                }),
              )) as unknown as typeof fetch,
      },
    );

    await expect(
      both.identity.resolve(
        new Request("https://server.test/", {
          headers: { authorization: `Bearer ${await tokenFor()}` },
        }),
      ),
    ).resolves.toMatchObject({ userId: "auth0|ana" });

    await expect(
      both.identity.resolve(
        new Request("https://server.test/", {
          headers: { "x-ticket": "TICKET_1" },
        }),
      ),
    ).resolves.toMatchObject({ userId: "tina" });

    expect(both.describe).toContain("also");
  });
});

// ------------------------------------------------------- scope membership ----

describe("buildScopeAuthority", () => {
  it("uses the seed file when no URL is configured", async () => {
    const { scopes, describe: line } = buildScopeAuthority(
      { kind: "seed" },
      { memberships: { acme: { ops: { ana: "Editor" } } } },
    );
    expect(line).toContain("seed");
    await expect(
      scopes.resolveScopeRole(
        {
          userId: "ana",
          tenantId: "acme",
          kind: "user",
          capabilities: { ...FULL_CAPABILITIES },
        },
        "ops",
      ),
    ).resolves.toBe("Editor");
  });

  it("asks the host when a URL is configured", async () => {
    const { scopes } = buildScopeAuthority(
      {
        kind: "http",
        url: "https://host.test/people/{userId}/sites/{scopeId}",
        method: "GET",
        rolePath: "entry.role",
        roleMap: { SiteManager: "Coordinator" },
        serviceHeader: undefined,
        absentStatuses: [404],
        cacheSeconds: 60,
        negativeCacheSeconds: 30,
        requestTimeoutMs: 5000,
      },
      {
        fetchImpl: emitterAnswering(200, { entry: { role: "SiteManager" } }),
      },
    );

    await expect(
      scopes.resolveScopeRole(
        {
          userId: "ana",
          tenantId: "acme",
          kind: "user",
          capabilities: { ...FULL_CAPABILITIES },
        },
        "ops",
      ),
    ).resolves.toBe("Coordinator");
  });

  it("reports a membership URL that is not https as a configuration error", () => {
    expect(() =>
      buildScopeAuthority({
        kind: "http",
        url: "http://host.test/{scopeId}",
        method: "GET",
        rolePath: "role",
        roleMap: undefined,
        serviceHeader: undefined,
        absentStatuses: [404],
        cacheSeconds: 60,
        negativeCacheSeconds: 30,
        requestTimeoutMs: 5000,
      }),
    ).toThrowError(ConfigError);
  });
});
