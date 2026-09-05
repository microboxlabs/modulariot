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
      // The rule applies to the insecure resolver, not to binding widely. A
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

/**
 * The JWT half of a verified configuration. More than one scheme can be
 * configured at once, so `auth` is the set and this reaches into it.
 */
const jwtAuthOf = (env: Record<string, string | undefined>) => {
  const { auth } = readServerConfig(env);
  return auth.kind === "verified" ? auth.jwt : undefined;
};

describe("readServerConfig: JWT authentication", () => {
  it("reads issuer, audience and claim names", () => {
    const jwt = jwtAuthOf({
      ...jwtBase,
      MIOT_DASHBOARD_JWT_AUDIENCE: "miot-dashboards, another-api",
      MIOT_DASHBOARD_JWT_USER_CLAIM: "email",
      MIOT_DASHBOARD_JWT_GROUPS_CLAIM: "https://miot.dev/groups",
      MIOT_DASHBOARD_JWT_NAME_CLAIM: "nickname",
    });

    expect(jwt).toEqual({
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
    // The algorithm is never configured on its own, so "accept either"
    // cannot be requested.
    expect(jwtAuthOf(jwtBase)).toMatchObject({ algorithm: "RS256" });

    const hmac = jwtAuthOf({
      ...jwtBase,
      MIOT_DASHBOARD_JWT_JWKS_URL: undefined,
      MIOT_DASHBOARD_JWT_SECRET: "x".repeat(32),
    });
    expect(hmac).toMatchObject({ algorithm: "HS256" });
  });

  it("hands the shared secret on byte for byte", () => {
    // Trimming would change the key: HMAC is computed over exactly these
    // bytes, so a trimmed secret stops matching the issuer's.
    const secret = `${"x".repeat(32)}   y`;
    expect(
      jwtAuthOf({
        ...jwtBase,
        MIOT_DASHBOARD_JWT_JWKS_URL: undefined,
        MIOT_DASHBOARD_JWT_SECRET: secret,
      }),
    ).toMatchObject({ key: { kind: "secret", secret } });
  });

  it("refuses a secret wrapped in whitespace instead of guessing", () => {
    // Keeping the whitespace and removing it both produce a server that
    // starts and then rejects every token, so it is settled here, where the
    // message can say why.
    expect(() =>
      readServerConfig({
        ...jwtBase,
        MIOT_DASHBOARD_JWT_JWKS_URL: undefined,
        MIOT_DASHBOARD_JWT_SECRET: `${"x".repeat(32)}\n`,
      }),
    ).toThrowError(/whitespace/);
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
    const jwt = jwtAuthOf({
      ...jwtBase,
      MIOT_DASHBOARD_JWT_JWKS_URL: undefined,
      MIOT_DASHBOARD_JWT_PUBLIC_KEY:
        "-----BEGIN PUBLIC KEY-----\\nMIIBIjAN\\n-----END PUBLIC KEY-----",
    });

    expect(jwt).toMatchObject({
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
      jwtAuthOf({
        ...jwtBase,
        MIOT_DASHBOARD_JWT_CLOCK_TOLERANCE: "120",
      }),
    ).toMatchObject({ clockToleranceSeconds: 120 });
  });
});

const ticketBase = {
  MIOT_DASHBOARD_TICKET_HEADER: "x-ticket",
  MIOT_DASHBOARD_TICKET_VALIDATE_URL: "https://emitter.test/tickets/-me-",
  MIOT_DASHBOARD_TICKET_PRESENT_NAME: "authorization",
  MIOT_DASHBOARD_TICKET_PRESENT_VALUE: "Basic {ticketBase64}",
  MIOT_DASHBOARD_TICKET_USER_PATH: "entry.id",
  MIOT_DASHBOARD_TICKET_TENANT: "acme",
};

const ticketAuthOf = (env: Record<string, string | undefined>) => {
  const { auth } = readServerConfig(env);
  return auth.kind === "verified" ? auth.ticket : undefined;
};

describe("readServerConfig: ticket authentication", () => {
  it("reads the header, the emitter and where the identity sits", () => {
    expect(
      ticketAuthOf({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_GROUPS_PATH: "entry.groups",
        MIOT_DASHBOARD_TICKET_NAME_PATH: "entry.displayName",
      }),
    ).toEqual({
      header: "x-ticket",
      scheme: undefined,
      url: "https://emitter.test/tickets/-me-",
      method: "GET",
      present: {
        kind: "header",
        name: "authorization",
        value: "Basic {ticketBase64}",
      },
      serviceHeader: undefined,
      tenant: { kind: "fixed", tenantId: "acme" },
      claims: {
        userId: "entry.id",
        groups: "entry.groups",
        displayName: "entry.displayName",
      },
      absentStatuses: [401, 404],
      cacheSeconds: 60,
      negativeCacheSeconds: 30,
      requestTimeoutMs: 5000,
    });
  });

  it.each([
    ["MIOT_DASHBOARD_TICKET_VALIDATE_URL", /VALIDATE_URL is required/],
    ["MIOT_DASHBOARD_TICKET_USER_PATH", /USER_PATH is required/],
  ])("refuses to start without %s", (key, message) => {
    expect(() =>
      readServerConfig({ ...ticketBase, [key]: undefined }),
    ).toThrowError(message);
  });

  it("refuses to start without a tenant", () => {
    // Without one every ticket holder would land in the same tenant.
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_TENANT: undefined,
      }),
    ).toThrowError(/needs a tenant/);
  });

  it("refuses a fixed tenant and a tenant path at once", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_TENANT_PATH: "entry.org",
      }),
    ).toThrowError(/exactly one/);
  });

  it("reads the tenant from the emitter's answer", () => {
    expect(
      ticketAuthOf({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_TENANT: undefined,
        MIOT_DASHBOARD_TICKET_TENANT_PATH: "entry.org",
      }),
    ).toMatchObject({ tenant: { kind: "path", path: "entry.org" } });
  });

  it("needs a name and a value to present the ticket in a header", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_PRESENT_VALUE: undefined,
      }),
    ).toThrowError(/PRESENT_NAME and MIOT_DASHBOARD_TICKET_PRESENT_VALUE/);
  });

  it("needs a parameter name to present the ticket in the query", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_PRESENT: "query",
        MIOT_DASHBOARD_TICKET_PRESENT_NAME: undefined,
      }),
    ).toThrowError(/PRESENT_NAME is required/);
  });

  it("takes a body presentation with nothing else to configure", () => {
    expect(
      ticketAuthOf({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_PRESENT: "body",
        MIOT_DASHBOARD_TICKET_PRESENT_NAME: undefined,
        MIOT_DASHBOARD_TICKET_PRESENT_VALUE: undefined,
      }),
    ).toMatchObject({ present: { kind: "body" } });
  });

  it("refuses a presentation it does not know", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_PRESENT: "cookie",
      }),
    ).toThrowError(/header, query or body/);
  });

  it("needs both halves of a service credential, or neither", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_SERVICE_HEADER: "x-api-key",
      }),
    ).toThrowError(/must be set together/);
  });

  it("accepts JWT and tickets at the same time", () => {
    // They read different headers, so a deployment can face a front-end
    // holding a token and a service holding a ticket.
    const { auth } = readServerConfig({ ...jwtBase, ...ticketBase });
    expect(auth.kind).toBe("verified");
    expect(auth.kind === "verified" && auth.jwt).toBeDefined();
    expect(auth.kind === "verified" && auth.ticket).toBeDefined();
  });

  it("refuses tickets alongside unverified header auth", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_INSECURE_AUTH: "true",
      }),
    ).toThrowError(/Two identity providers/);
  });

  it.each(["-1", "3601", "1.5", "soon"])(
    "refuses a cache of %j seconds",
    (value) => {
      expect(() =>
        readServerConfig({ ...ticketBase, MIOT_DASHBOARD_TICKET_CACHE: value }),
      ).toThrowError(ConfigError);
    },
  );

  it("refuses a status list that is not statuses", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_INVALID_STATUS: "401,nope",
      }),
    ).toThrowError(/HTTP statuses/);
  });
});

describe("readServerConfig: scope membership", () => {
  it("reads membership from the seed file unless a URL is set", () => {
    expect(readServerConfig(jwtBase).scopes).toEqual({ kind: "seed" });
  });

  it("delegates to the host when a URL is set", () => {
    expect(
      readServerConfig({
        ...jwtBase,
        MIOT_DASHBOARD_SCOPES_URL:
          "https://host.test/people/{userId}/sites/{scopeId}",
        MIOT_DASHBOARD_SCOPES_ROLE_PATH: "entry.role",
        MIOT_DASHBOARD_SCOPES_ROLE_MAP:
          "SiteManager=Coordinator, SiteConsumer=Consumer",
        MIOT_DASHBOARD_SCOPES_SERVICE_HEADER: "authorization",
        MIOT_DASHBOARD_SCOPES_SERVICE_VALUE: "Bearer service-token",
      }).scopes,
    ).toEqual({
      kind: "http",
      url: "https://host.test/people/{userId}/sites/{scopeId}",
      method: "GET",
      rolePath: "entry.role",
      roleMap: { SiteManager: "Coordinator", SiteConsumer: "Consumer" },
      serviceHeader: { name: "authorization", value: "Bearer service-token" },
      absentStatuses: [404],
      cacheSeconds: 60,
      negativeCacheSeconds: 30,
      requestTimeoutMs: 5000,
    });
  });

  it("refuses a mapping onto a role that does not exist", () => {
    expect(() =>
      readServerConfig({
        ...jwtBase,
        MIOT_DASHBOARD_SCOPES_URL: "https://host.test/{scopeId}",
        MIOT_DASHBOARD_SCOPES_ROLE_MAP: "SiteManager=Admin",
      }),
    ).toThrowError(/not one of Consumer, Contributor, Editor, Coordinator/);
  });

  it("refuses a mapping that is not pairs", () => {
    expect(() =>
      readServerConfig({
        ...jwtBase,
        MIOT_DASHBOARD_SCOPES_URL: "https://host.test/{scopeId}",
        MIOT_DASHBOARD_SCOPES_ROLE_MAP: "SiteManager",
      }),
    ).toThrowError(/<host role>=<role>/);
  });

  it("builds the mapping without a prototype to walk into", () => {
    const { scopes } = readServerConfig({
      ...jwtBase,
      MIOT_DASHBOARD_SCOPES_URL: "https://host.test/{scopeId}",
      MIOT_DASHBOARD_SCOPES_ROLE_MAP: "SiteManager=Coordinator",
    });
    // A host role literally named "constructor" must not resolve to a
    // function, and neither must one named "__proto__".
    expect(
      scopes.kind === "http" && scopes.roleMap?.constructor,
    ).toBeUndefined();
  });
});

describe("readServerConfig: ticket presentation and service credential", () => {
  it("defaults the method to POST when the ticket goes in the body", () => {
    expect(
      ticketAuthOf({ ...ticketBase, MIOT_DASHBOARD_TICKET_PRESENT: "body" }),
    ).toMatchObject({ method: "POST", present: { kind: "body" } });
  });

  it("refuses body presentation with an explicit GET", () => {
    expect(() =>
      readServerConfig({
        ...ticketBase,
        MIOT_DASHBOARD_TICKET_PRESENT: "body",
        MIOT_DASHBOARD_TICKET_VALIDATE_METHOD: "GET",
      }),
    ).toThrowError(/VALIDATE_METHOD=POST/);
  });

  it("requires the invalid statuses when a service credential is sent", () => {
    const withService = {
      ...ticketBase,
      MIOT_DASHBOARD_TICKET_SERVICE_HEADER: "authorization",
      MIOT_DASHBOARD_TICKET_SERVICE_VALUE: "Bearer service-token",
    };
    expect(() => readServerConfig(withService)).toThrowError(
      /MIOT_DASHBOARD_TICKET_INVALID_STATUS must be set/,
    );
    expect(
      ticketAuthOf({
        ...withService,
        MIOT_DASHBOARD_TICKET_INVALID_STATUS: "404",
      }),
    ).toMatchObject({ absentStatuses: [404] });
  });
});
