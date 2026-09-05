import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth }));

import { GET } from "./route";

const fetchMock = vi.fn();
const LOGO = new Uint8Array([1, 2, 3, 4]);

function params(domain: string) {
  return { params: Promise.resolve({ domain }) };
}

function upstreamLogo(): Response {
  return new Response(LOGO, {
    status: 200,
    headers: { "Content-Type": "image/png" },
  });
}

beforeEach(() => {
  vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  auth.mockResolvedValue({ user: { id: "auth0|1" } });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("admin logo preview proxy", () => {
  it("serves a domain other than the request's own host", async () => {
    fetchMock.mockResolvedValue(upstreamLogo());

    const response = await GET(
      new Request("http://localhost"),
      params("portal.example.com"),
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/branding/portal.example.com/logo",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(LOGO);
  });

  it("keeps the SVG hardening headers on the preview", async () => {
    fetchMock.mockResolvedValue(upstreamLogo());

    const response = await GET(
      new Request("http://localhost"),
      params("portal.example.com"),
    );

    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");
  });

  it("requires a session", async () => {
    auth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost"),
      params("portal.example.com"),
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normalizes the host before building the upstream URL", async () => {
    fetchMock.mockResolvedValue(upstreamLogo());

    await GET(new Request("http://localhost"), params("PORTAL.Example.COM:8443"));

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/branding/portal.example.com/logo",
    );
  });

  it("rejects a malformed domain without calling upstream", async () => {
    const response = await GET(
      new Request("http://localhost"),
      params("../../api/v1/platform"),
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes an unconfigured domain through as 404", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(
      new Request("http://localhost"),
      params("nothing-here.test"),
    );

    expect(response.status).toBe(404);
  });

  it("answers 502 when the modulith is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const response = await GET(
      new Request("http://localhost"),
      params("portal.example.com"),
    );

    expect(response.status).toBe(502);
  });
});
