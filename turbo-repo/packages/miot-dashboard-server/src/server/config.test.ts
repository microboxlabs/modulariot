import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_CLOCK_TOLERANCE_SECONDS,
  DEFAULT_SQLITE_PATH,
  readServerConfig,
} from "./config";

const base = { MIOT_DASHBOARD_INSECURE_AUTH: "true" };

describe("readServerConfig", () => {
  it("defaults to a loopback address, so a dev server is not reachable off-box", () => {
    const config = readServerConfig(base);
    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(3070);
    expect(config.basePath).toBe("");
  });

  it("refuses the unverified identity resolver under NODE_ENV=production", () => {
    expect(() =>
      readServerConfig({ ...base, NODE_ENV: "production" }),
    ).toThrowError(ConfigError);
  });

  it("refuses to start with no identity provider at all", () => {
    // Failing closed matters more than convenience here: a server that starts
    // without authentication is worse than one that will not start.
    expect(() => readServerConfig({})).toThrowError(ConfigError);
    expect(() => readServerConfig({})).toThrowError(/identity provider/i);
  });

  it("rejects a store it cannot build rather than silently using memory", () => {
    expect(() =>
      readServerConfig({ ...base, MIOT_DASHBOARD_STORE: "postgres" }),
    ).toThrowError(/not supported/i);
    expect(() =>
      readServerConfig({ ...base, MIOT_DASHBOARD_STORE: "postgres" }),
    ).toThrowError(/memory, sqlite/);
  });

  describe("the store", () => {
    it("keeps everything in memory unless asked otherwise", () => {
      expect(readServerConfig(base).store).toBe("memory");
    });

    it("takes sqlite with a default file, so it needs no other setting", () => {
      const config = readServerConfig({
        ...base,
        MIOT_DASHBOARD_STORE: "sqlite",
      });
      expect(config.store).toBe("sqlite");
      expect(config.sqlitePath).toBe(DEFAULT_SQLITE_PATH);
    });

    it("takes an explicit database file", () => {
      const config = readServerConfig({
        ...base,
        MIOT_DASHBOARD_STORE: "sqlite",
        MIOT_DASHBOARD_SQLITE_PATH: "/var/lib/miot/dash.db",
      });
      expect(config.sqlitePath).toBe("/var/lib/miot/dash.db");
    });

    it("carries no hostname or credential in any default", () => {
      // A default naming a real database would let one deployment write to
      // another deployment's data.
      expect(DEFAULT_SQLITE_PATH.startsWith("./")).toBe(true);
      expect(DEFAULT_SQLITE_PATH).not.toMatch(/:\/\/|@/);
    });
  });

  it("validates the port", () => {
    expect(() => readServerConfig({ ...base, PORT: "0" })).toThrowError(
      ConfigError,
    );
    expect(() => readServerConfig({ ...base, PORT: "70000" })).toThrowError(
      ConfigError,
    );
    expect(() => readServerConfig({ ...base, PORT: "abc" })).toThrowError(
      ConfigError,
    );
    expect(readServerConfig({ ...base, PORT: "8080" }).port).toBe(8080);
  });

  it("accepts the documented truthy spellings only", () => {
    expect(
      readServerConfig({ MIOT_DASHBOARD_INSECURE_AUTH: "1" }).auth.kind,
    ).toBe("insecure");
    expect(() =>
      readServerConfig({ MIOT_DASHBOARD_INSECURE_AUTH: "yes" }),
    ).toThrowError(ConfigError);
  });

  it("serves the contract unless someone turns it off", () => {
    // The opposite default to the insecure-auth switch, and deliberately so:
    // that one is dangerous and must be asked for, this one describes a public
    // interface and costs nothing to have on.
    expect(readServerConfig(base).docs).toBe(true);
    expect(
      readServerConfig({ ...base, MIOT_DASHBOARD_DOCS: "false" }).docs,
    ).toBe(false);
    expect(readServerConfig({ ...base, MIOT_DASHBOARD_DOCS: "0" }).docs).toBe(
      false,
    );
    expect(
      readServerConfig({ ...base, MIOT_DASHBOARD_DOCS: "true" }).docs,
    ).toBe(true);
  });

  describe("insecure auth is confined to loopback", () => {
    // With unverified header auth, reaching the port *is* being every user in
    // every tenant. NODE_ENV is not a boundary — it is a variable nobody has
    // to set — so the address the socket binds to is the check that holds.
    it.each(["0.0.0.0", "::", "[::]", "192.168.1.10", "10.0.0.5", ""])(
      "refuses to start on %j",
      (host) => {
        expect(() => readServerConfig({ ...base, HOST: host })).toThrowError(
          ConfigError,
        );
        expect(() => readServerConfig({ ...base, HOST: host })).toThrowError(
          /loopback/i,
        );
      },
    );

    it.each([
      "127.0.0.1",
      "127.0.0.53",
      "localhost",
      "LOCALHOST",
      "::1",
      "[::1]",
      " 127.0.0.1 ",
    ])("starts on %j", (host) => {
      expect(readServerConfig({ ...base, HOST: host }).host).toBe(host);
    });

    it("defaults to loopback when HOST is unset", () => {
      expect(readServerConfig(base).host).toBe("127.0.0.1");
    });

    it("still demands an identity provider when the switch is off", () => {
      expect(() =>
        readServerConfig({
          MIOT_DASHBOARD_INSECURE_AUTH: "false",
          HOST: "0.0.0.0",
        }),
      ).toThrowError(/identity provider/i);
    });

    it("does not constrain the host once tokens are verified", () => {
      // The rule is about the insecure resolver, not about binding widely. A
      // server that verifies signatures is meant to be reachable.
      expect(readServerConfig({ ...jwtBase, HOST: "0.0.0.0" }).host).toBe(
        "0.0.0.0",
      );
    });
  });
});

const jwtBase = {
  MIOT_DASHBOARD_JWT_ISSUER: "https://issuer.test/",
  MIOT_DASHBOARD_JWT_AUDIENCE: "miot-dashboards",
  MIOT_DASHBOARD_JWT_TENANT_CLAIM: "https://miot.dev/tenant_id",
  MIOT_DASHBOARD_JWT_JWKS_URL: "https://issuer.test/.well-known/jwks.json",
};

describe("readServerConfig: JWT authentication", () => {
  it("reads issuer, audience and claim names", () => {
    const config = readServerConfig({
      ...jwtBase,
      MIOT_DASHBOARD_JWT_AUDIENCE: "miot-dashboards, another-api",
      MIOT_DASHBOARD_JWT_USER_CLAIM: "email",
      MIOT_DASHBOARD_JWT_GROUPS_CLAIM: "https://miot.dev/groups",
      MIOT_DASHBOARD_JWT_NAME_CLAIM: "nickname",
    });

    expect(config.auth).toEqual({
      kind: "jwt",
      issuer: "https://issuer.test/",
      audience: ["miot-dashboards", "another-api"],
      algorithm: "RS256",
      key: {
        kind: "jwks",
        url: "https://issuer.test/.well-known/jwks.json",
      },
      claims: {
        tenantId: "https://miot.dev/tenant_id",
        userId: "email",
        groups: "https://miot.dev/groups",
        displayName: "nickname",
      },
      clockToleranceSeconds: DEFAULT_CLOCK_TOLERANCE_SECONDS,
    });
  });

  it("derives the algorithm from the key source", () => {
    // The algorithm is never configured on its own, which is what makes
    // "accept either" impossible to ask for.
    const rsa = readServerConfig(jwtBase).auth;
    expect(rsa).toMatchObject({ algorithm: "RS256" });

    const hmac = readServerConfig({
      ...jwtBase,
      MIOT_DASHBOARD_JWT_JWKS_URL: undefined,
      MIOT_DASHBOARD_JWT_SECRET: "x".repeat(32),
    }).auth;
    expect(hmac).toMatchObject({ algorithm: "HS256" });
  });

  it("refuses two key sources at once", () => {
    expect(() =>
      readServerConfig({
        ...jwtBase,
        MIOT_DASHBOARD_JWT_SECRET: "x".repeat(32),
      }),
    ).toThrowError(/exactly one JWT key source/);
  });

  it("refuses JWT and header auth at the same time", () => {
    expect(() =>
      readServerConfig({ ...jwtBase, MIOT_DASHBOARD_INSECURE_AUTH: "true" }),
    ).toThrowError(/Two identity providers/);
  });

  it.each([
    ["MIOT_DASHBOARD_JWT_ISSUER", /ISSUER is required/],
    ["MIOT_DASHBOARD_JWT_AUDIENCE", /AUDIENCE is required/],
    ["MIOT_DASHBOARD_JWT_TENANT_CLAIM", /TENANT_CLAIM is required/],
    ["MIOT_DASHBOARD_JWT_JWKS_URL", /needs a key/],
  ])("refuses to start without %s", (key, message) => {
    expect(() =>
      readServerConfig({ ...jwtBase, [key]: undefined }),
    ).toThrowError(message);
  });

  it("treats a blank variable as absent rather than as a value", () => {
    expect(() =>
      readServerConfig({ ...jwtBase, MIOT_DASHBOARD_JWT_ISSUER: "   " }),
    ).toThrowError(/ISSUER is required/);
  });

  it("restores the newlines a PEM loses on its way through the environment", () => {
    const config = readServerConfig({
      ...jwtBase,
      MIOT_DASHBOARD_JWT_JWKS_URL: undefined,
      MIOT_DASHBOARD_JWT_PUBLIC_KEY:
        "-----BEGIN PUBLIC KEY-----\\nMIIBIjAN\\n-----END PUBLIC KEY-----",
    });

    expect(config.auth).toMatchObject({
      algorithm: "RS256",
      key: {
        kind: "publicKey",
        pem: "-----BEGIN PUBLIC KEY-----\nMIIBIjAN\n-----END PUBLIC KEY-----",
      },
    });
  });

  it.each(["-1", "301", "1.5", "soon"])(
    "refuses a clock tolerance of %j",
    (value) => {
      expect(() =>
        readServerConfig({
          ...jwtBase,
          MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE: value,
        }),
      ).toThrowError(ConfigError);
    },
  );

  it("accepts a clock tolerance inside the cap", () => {
    expect(
      readServerConfig({
        ...jwtBase,
        MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE: "120",
      }).auth,
    ).toMatchObject({ clockToleranceSeconds: 120 });
  });
});
