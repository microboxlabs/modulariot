import { describe, expect, it } from "vitest";
import { ConfigError, readServerConfig } from "./config";

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
    ).toThrowError(/not supported yet/i);
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
});
