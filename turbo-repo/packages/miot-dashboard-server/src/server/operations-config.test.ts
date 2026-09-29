import { describe, expect, it } from "vitest";
import { ConfigError, readServerConfig } from "./config";

const env = {
  MIOT_DASHBOARD_JWT_ISSUER: "https://issuer.example",
  MIOT_DASHBOARD_JWT_AUDIENCE: "dashboard",
  MIOT_DASHBOARD_JWT_SECRET: "a".repeat(32),
  MIOT_DASHBOARD_PROXY_KEY: "b".repeat(32),
  MIOT_DASHBOARD_OPERATIONS_URL:
    "https://host.example/internal/dashboard-operations",
};

describe("standalone host operations", () => {
  it("leaves query execution off without an endpoint", () => {
    expect(
      readServerConfig({ MIOT_DASHBOARD_INSECURE_AUTH: "true" }).operations,
    ).toBeUndefined();
  });
  it("requires service authentication and defaults to a bounded HTTPS endpoint", () => {
    expect(readServerConfig(env).operations).toEqual({
      url: env.MIOT_DASHBOARD_OPERATIONS_URL,
      proxyKey: env.MIOT_DASHBOARD_PROXY_KEY,
      allowHttp: false,
      requestTimeoutMs: 20000,
    });
    expect(() =>
      readServerConfig({ ...env, MIOT_DASHBOARD_PROXY_KEY: "" }),
    ).toThrow(ConfigError);
  });
  it.each(["0", "-1", "1.5", "invalid", "Infinity", "20001"])(
    "refuses invalid deadline %s",
    (timeout) => {
      expect(() =>
        readServerConfig({
          ...env,
          MIOT_DASHBOARD_OPERATIONS_TIMEOUT: timeout,
        }),
      ).toThrow(ConfigError);
    },
  );
  it.each([
    "http://host.example",
    "https://user:secret@host.example",
    "https://host.example/#secret",
    "file:///etc/passwd",
  ])("refuses unsafe host URLs without exposing them", (url) => {
    expect(() =>
      readServerConfig({ ...env, MIOT_DASHBOARD_OPERATIONS_URL: url }),
    ).toThrow("Invalid dashboard operations endpoint or timeout configuration");
  });
  it("permits loopback and explicit private HTTP with a shorter deadline", () => {
    expect(
      readServerConfig({
        ...env,
        MIOT_DASHBOARD_OPERATIONS_URL: "http://127.0.0.1:8080",
      }).operations?.allowHttp,
    ).toBe(false);
    expect(
      readServerConfig({
        ...env,
        MIOT_DASHBOARD_OPERATIONS_URL: "http://host.internal",
        MIOT_DASHBOARD_OPERATIONS_ALLOW_HTTP: "true",
        MIOT_DASHBOARD_OPERATIONS_TIMEOUT: "1500",
      }).operations?.requestTimeoutMs,
    ).toBe(1500);
  });
});
