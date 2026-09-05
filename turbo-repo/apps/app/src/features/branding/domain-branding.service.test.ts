import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const headersMock = vi.fn();
vi.mock("next/headers", () => ({ headers: () => headersMock() }));
vi.mock("server-only", () => ({}));

import { getDomainBranding } from "./domain-branding.service";

function summary(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      domain: "portal.example.com",
      hasLogo: true,
      logoEtag: "abc123",
      hasDarkLogo: false,
      logoDarkEtag: null,
      homeUrl: "https://example.com/",
      ...overrides,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("getDomainBranding", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/app");
    vi.stubGlobal("fetch", fetchMock);
    headersMock.mockResolvedValue(
      new Headers({ "x-forwarded-host": "portal.example.com" }),
    );
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks the modulith for the request host and returns a versioned same-origin URL", async () => {
    fetchMock.mockResolvedValue(summary());

    await expect(getDomainBranding()).resolves.toEqual({
      logoUrl: "/app/api/branding/logo?v=abc123",
      logoUrlDark: null,
      homeUrl: "https://example.com/",
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/branding/portal.example.com",
    );
  });

  it("returns null when the domain has no logo", async () => {
    fetchMock.mockResolvedValue(
      summary({ hasLogo: false, logoEtag: null, homeUrl: null }),
    );
    await expect(getDomainBranding()).resolves.toBeNull();
  });

  it("returns null rather than throwing when the modulith is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(getDomainBranding()).resolves.toBeNull();
  });

  it("returns null on an upstream error status", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(getDomainBranding()).resolves.toBeNull();
  });

  it("does not call the modulith when it is not configured", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");
    await expect(getDomainBranding()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call the modulith when the host is malformed", async () => {
    headersMock.mockResolvedValue(new Headers({ host: "not..a..domain" }));
    await expect(getDomainBranding()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("addresses the dark variant separately when the domain ships one", async () => {
    fetchMock.mockResolvedValue(
      summary({ hasDarkLogo: true, logoDarkEtag: "dark456" }),
    );

    await expect(getDomainBranding()).resolves.toEqual({
      logoUrl: "/app/api/branding/logo?v=abc123",
      logoUrlDark: "/app/api/branding/logo?v=dark456&variant=dark",
      homeUrl: "https://example.com/",
    });
  });

  it("leaves the dark URL null when the domain ships one logo for both", async () => {
    fetchMock.mockResolvedValue(summary());

    await expect(getDomainBranding()).resolves.toMatchObject({
      logoUrlDark: null,
    });
  });
});
