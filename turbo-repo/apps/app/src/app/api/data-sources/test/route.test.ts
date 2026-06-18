/**
 * Coverage for the stateless connection-test endpoint.
 *
 * Unlike POST /api/data-sources/{id}/test (which loads the persisted, encrypted
 * config by id), this route tests the connection using the *inline* form data in
 * the request body. It performs NO persistence — it never touches the data-source
 * store, so a user can validate a provider before saving it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const resolveSiteMock = vi.fn();
const validateTargetUrlMock = vi.fn();
const exchangeOAuthTokenMock = vi.fn();

vi.mock("@/app/api/utils/org-resolver", () => ({
  resolveSiteForRequest: (...args: unknown[]) => resolveSiteMock(...args),
}));

vi.mock("@/app/api/utils/url-validator", () => ({
  validateTargetUrl: (...args: unknown[]) => validateTargetUrlMock(...args),
}));

vi.mock("@/app/api/data-sources/resolve-credentials", () => ({
  exchangeOAuthToken: (...args: unknown[]) => exchangeOAuthTokenMock(...args),
  buildAuthHeader: (token: string) => `Bearer ${token}`,
}));

function makeResponse({
  ok,
  status,
  statusText = "",
  jsonData,
}: {
  ok: boolean;
  status: number;
  statusText?: string;
  jsonData?: unknown;
}) {
  return {
    ok,
    status,
    statusText,
    json: async () => jsonData,
  };
}

function makeRequest(body: unknown, siteId = "site-1") {
  return new Request(`https://app.example.com/api/data-sources/test?siteId=${siteId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const fetchMock = vi.fn();

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

describe("POST /api/data-sources/test (stateless)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    resolveSiteMock.mockReset();
    validateTargetUrlMock.mockReset();
    exchangeOAuthTokenMock.mockReset();

    // Default: authenticated + member of the site.
    resolveSiteMock.mockResolvedValue({
      resolved: true,
      data: { siteId: "site-1", session: { user: { id: "u1" } } },
    });
    // Default: target URL passes SSRF validation.
    validateTargetUrlMock.mockResolvedValue({ valid: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns the auth failure response when the site cannot be resolved", async () => {
    const { NextResponse } = await import("next/server");
    resolveSiteMock.mockResolvedValue({
      resolved: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const { POST } = await loadRoute();

    const res = await POST(makeRequest({ type: "POSTGREST", url: "https://db.example.com", authMethod: "TOKEN", token: "secret" }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid body with 400 and does not probe the upstream", async () => {
    const { POST } = await loadRoute();

    // TOKEN auth without a token is invalid.
    const res = await POST(makeRequest({ type: "POSTGREST", url: "https://db.example.com", authMethod: "TOKEN" }));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 (not 500) for a malformed JSON body", async () => {
    const { POST } = await loadRoute();

    const req = new Request("https://app.example.com/api/data-sources/test?siteId=site-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tests a TOKEN connection using the inline token from the body", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, jsonData: {} }));
    const { POST } = await loadRoute();

    const res = await POST(
      makeRequest({ type: "POSTGREST", url: "https://db.example.com", authMethod: "TOKEN", token: "form-token" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // The probe must use the token from the request body, not any stored credential.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://db.example.com/");
    expect(init.headers.Authorization).toBe("Bearer form-token");
  });

  it("normalizes a trailing slash in the url so the probe URL has no double slash", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, jsonData: {} }));
    const { POST } = await loadRoute();

    await POST(
      makeRequest({ type: "POSTGREST", url: "https://db.example.com/", authMethod: "TOKEN", token: "t" })
    );

    const [calledUrl] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe("https://db.example.com/");
  });

  it("reports success:false when the TOKEN probe gets a non-OK response", async () => {
    fetchMock.mockResolvedValue(makeResponse({ ok: false, status: 401, statusText: "Unauthorized" }));
    const { POST } = await loadRoute();

    const res = await POST(
      makeRequest({ type: "POSTGREST", url: "https://db.example.com", authMethod: "TOKEN", token: "bad" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toContain("401");
  });

  it("exchanges OAuth credentials inline, then probes with the resulting token", async () => {
    exchangeOAuthTokenMock.mockResolvedValue({ accessToken: "minted", detectedFormat: "form", expiresAt: 0 });
    fetchMock.mockResolvedValue(makeResponse({ ok: true, status: 200, jsonData: {} }));
    const { POST } = await loadRoute();

    const res = await POST(
      makeRequest({
        type: "POSTGREST",
        url: "https://db.example.com",
        authMethod: "OAUTH",
        clientId: "cid",
        clientSecret: "csecret",
        tokenUrl: "https://auth.example.com/token",
        scope: "read",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // Exchange must use the raw secret from the body (no decryption, no dataSourceId/cache).
    expect(exchangeOAuthTokenMock).toHaveBeenCalledWith(
      "https://auth.example.com/token",
      "cid",
      "csecret",
      "read",
      undefined, // audience
      undefined // tokenRequestFormat
    );
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer minted");
  });

  it("reports success:false when the OAuth exchange fails", async () => {
    exchangeOAuthTokenMock.mockRejectedValue(new Error("OAuth token exchange failed: HTTP 401 — bad client"));
    const { POST } = await loadRoute();

    const res = await POST(
      makeRequest({
        type: "POSTGREST",
        url: "https://db.example.com",
        authMethod: "OAUTH",
        clientId: "cid",
        clientSecret: "csecret",
        tokenUrl: "https://auth.example.com/token",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toContain("OAuth token exchange failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the OAuth tokenUrl against SSRF before exchanging the token", async () => {
    // First validateTargetUrl call (the tokenUrl check) fails.
    validateTargetUrlMock.mockResolvedValueOnce({ valid: false, reason: "blocked private address" });
    exchangeOAuthTokenMock.mockResolvedValue({ accessToken: "minted", detectedFormat: "form", expiresAt: 0 });
    const { POST } = await loadRoute();

    const res = await POST(
      makeRequest({
        type: "POSTGREST",
        url: "https://db.example.com",
        authMethod: "OAUTH",
        clientId: "cid",
        clientSecret: "csecret",
        tokenUrl: "https://169.254.169.254/token",
      })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toContain("blocked private address");
    // Must not attempt the token exchange (or any upstream fetch) on SSRF rejection.
    expect(exchangeOAuthTokenMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports success:false when the target URL fails SSRF validation", async () => {
    validateTargetUrlMock.mockResolvedValue({ valid: false, reason: "blocked private address" });
    const { POST } = await loadRoute();

    const res = await POST(
      makeRequest({ type: "POSTGREST", url: "https://169.254.169.254", authMethod: "TOKEN", token: "x" })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(false);
    expect(body.error).toContain("blocked private address");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
