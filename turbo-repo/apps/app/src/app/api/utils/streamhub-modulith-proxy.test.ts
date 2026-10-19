import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const proxyMock = vi.fn();

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

import { forwardToStreamhubModulith } from "./streamhub-modulith-proxy";

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
});
