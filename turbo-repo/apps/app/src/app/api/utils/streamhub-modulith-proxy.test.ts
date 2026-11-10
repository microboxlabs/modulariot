import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const proxyMock = vi.fn();
const fetchMock = vi.fn();
const modulithHostMock = vi.fn(() => "http://modulith.test");

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", email: "ana@example.com" } }),
}));
vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => modulithHostMock(),
}));
vi.mock("@/features/auth/services/session-auth", () => ({
  sessionAuthHeader: () => ({ Authorization: "Bearer user-jwt" }),
}));
vi.mock("@/app/api/utils/upstream-proxy", () => ({
  proxyToUpstream: (...args: unknown[]) => proxyMock(...args),
}));

import {
  forwardToStreamhubModulith,
  relayToStreamhubModulith,
} from "./streamhub-modulith-proxy";

const sentHeaders = () => proxyMock.mock.calls[0][2] as Record<string, string>;

describe("forwardToStreamhubModulith", () => {
  beforeEach(() => {
    proxyMock.mockReset();
    proxyMock.mockResolvedValue(NextResponse.json({}));
    modulithHostMock.mockReturnValue("http://modulith.test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("forwards the user's token and email", async () => {
    await forwardToStreamhubModulith("/x", { method: "GET" });
    expect(sentHeaders().Authorization).toBe("Bearer user-jwt");
    expect(sentHeaders()["X-Dev-User-Email"]).toBe("ana@example.com");
  });

  it("forwards the user's token for the platform scope", async () => {
    await forwardToStreamhubModulith(
      "/api/v1/orgs/_platform/conversations/templates",
      { method: "GET" }
    );
    expect(sentHeaders().Authorization).toBe("Bearer user-jwt");
  });

  it("uses MIOT_STREAMHUB_API_URL when set", async () => {
    vi.stubEnv("MIOT_STREAMHUB_API_URL", "http://gps-api.test/");
    await forwardToStreamhubModulith("/x");
    expect(proxyMock.mock.calls[0][0]).toBe("http://gps-api.test");
  });

  it("falls back to MIOT_MODULITH_URL without MIOT_STREAMHUB_API_URL", async () => {
    vi.stubEnv("MIOT_STREAMHUB_API_URL", "");
    await forwardToStreamhubModulith("/x");
    expect(proxyMock.mock.calls[0][0]).toBe("http://modulith.test");
  });

  it("answers 500 when neither URL is configured", async () => {
    vi.stubEnv("MIOT_STREAMHUB_API_URL", "");
    modulithHostMock.mockReturnValue("");
    const response = await forwardToStreamhubModulith("/x");
    expect(response.status).toBe(500);
    expect(proxyMock).not.toHaveBeenCalled();
  });
});

describe("relayToStreamhubModulith", () => {
  beforeEach(() => {
    modulithHostMock.mockReturnValue("http://modulith.test");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("preserves the sandbox policy and uses the user's session for proof content", async () => {
    const policy = "sandbox; default-src 'none'; img-src 'self' data:";
    fetchMock.mockResolvedValue(
      new Response("%PDF-test", {
        headers: {
          "content-type": "application/pdf",
          "content-security-policy": policy,
        },
      })
    );
    const response = await relayToStreamhubModulith("/proof", {
      method: "GET",
    });
    expect(response.headers.get("content-security-policy")).toBe(policy);
    expect(await response.text()).toBe("%PDF-test");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer user-jwt" }),
      })
    );
  });

  it("returns a readable gateway error when the upstream is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("test network unavailable"));
    const response = await relayToStreamhubModulith("/proof", {
      method: "POST",
      body: "sample",
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Content service is temporarily unavailable. Please try again.",
    });
  });
});
