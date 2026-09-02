import { describe, expect, it } from "vitest";
import { ConfigError, DEFAULT_SQLITE_PATH, readServerConfig } from "./config";

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
      // A default pointing at a real database is how one deployment ends up
      // writing to another's.
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
      readServerConfig({ MIOT_DASHBOARD_INSECURE_AUTH: "1" }).insecureAuth,
    ).toBe(true);
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

    it("does not constrain the host once auth is not the insecure one", () => {
      // The rule is about the insecure resolver, not about binding widely.
      // When a verifying resolver lands in P2b, 0.0.0.0 becomes legitimate and
      // this check must not stand in its way.
      expect(() =>
        readServerConfig({
          MIOT_DASHBOARD_INSECURE_AUTH: "false",
          HOST: "0.0.0.0",
        }),
      ).toThrowError(/identity provider/i);
    });
  });
});
