import { describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));

import { domainFromHeaders, resolveRequestDomain } from "./request-domain";

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
