import { describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import {
  domainFromHeaders,
  normalizeDomain,
  resolveRequestDomain,
} from "./request-domain";

describe("normalizeDomain", () => {
  it("lowercases, trims and strips the port and trailing dot", () => {
    expect(normalizeDomain("  PORTAL.Example.COM.:8443 ")).toBe(
      "portal.example.com",
    );
  });

  it("keeps a plain host untouched", () => {
    expect(normalizeDomain("storm.modulariot.com")).toBe(
      "storm.modulariot.com",
    );
  });

  it.each([
    ["empty", ""],
    ["null", null],
    ["undefined", undefined],
    ["empty label", "not..a..domain"],
    ["leading hyphen", "-bad.example"],
    ["trailing hyphen", "bad-.example"],
    ["underscore", "under_score.example"],
    ["path traversal", "evil.example/../../api/v1/platform"],
    ["non-numeric suffix after colon", "https://example.com"],
    ["overlong label", `${"a".repeat(64)}.example`],
    ["overlong name", `${"a.".repeat(127)}example`],
  ])("rejects %s", (_label, value) => {
    expect(normalizeDomain(value)).toBeNull();
  });
});

describe("domainFromHeaders", () => {
  it("prefers the first x-forwarded-host entry over host", () => {
    const headers = new Headers({
      "x-forwarded-host": "portal.example.com, internal-svc",
      host: "0.0.0.0:3000",
    });
    expect(domainFromHeaders(headers)).toBe("portal.example.com");
  });

  it("falls back to host when the proxy header is absent", () => {
    expect(domainFromHeaders(new Headers({ host: "localhost:3050" }))).toBe(
      "localhost",
    );
  });

  it("returns null when neither header is present", () => {
    expect(domainFromHeaders(new Headers())).toBeNull();
  });
});

describe("resolveRequestDomain", () => {
  it("reads the request headers", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "portal.example.com" }));
    await expect(resolveRequestDomain()).resolves.toBe("portal.example.com");
  });
});
