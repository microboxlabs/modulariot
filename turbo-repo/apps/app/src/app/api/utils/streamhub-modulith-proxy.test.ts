import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const proxyMock = vi.fn();
const fetchMock = vi.fn();

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/auth", () => ({
  auth: async () => ({ user: { id: "u1", email: "ana@example.com" } }),
}));
vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "http://modulith.test",
}));
vi.mock("@/features/auth/services/session-auth", () => ({
  sessionAuthHeader: () => ({ Authorization: "Bearer user-jwt" }),
}));
vi.mock("@/app/api/utils/streamhub-api-client", () => ({
  getSharedAuthToken: () => ({ getToken: async () => "shared-m2m" }),
}));
vi.mock("@/app/api/utils/upstream-proxy", () => ({
  proxyToUpstream: (...args: unknown[]) => proxyMock(...args),
}));

import {
  forwardToStreamhubModulith,
  relayToStreamhubModulith,
} from "./streamhub-modulith-proxy";

const sentAuthorization = () =>
  (proxyMock.mock.calls[0][2] as Record<string, string>).Authorization;

describe("forwardToStreamhubModulith", () => {
  beforeEach(() => {
    proxyMock.mockReset();
    proxyMock.mockResolvedValue(NextResponse.json({}));
    vi.stubEnv("MIOT_STREAMHUB_AUTH", "m2m");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the shared token when the deployment asks for m2m", async () => {
    await forwardToStreamhubModulith("/x", { method: "GET" });
    expect(sentAuthorization()).toBe("Bearer shared-m2m");
  });

  it("forwards the user's token for a session-only call", async () => {
    await forwardToStreamhubModulith("/x", {
      method: "GET",
      sessionOnly: true,
    });
    expect(sentAuthorization()).toBe("Bearer user-jwt");
  });

  it("forwards the user's token for the platform scope", async () => {
    await forwardToStreamhubModulith(
      "/api/v1/orgs/_platform/conversations/templates",
      { method: "GET" }
    );
    expect(sentAuthorization()).toBe("Bearer user-jwt");
  });
});

describe("relayToStreamhubModulith", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("MIOT_STREAMHUB_AUTH", "m2m");
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
