import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

function request(headers: Record<string, string>): Request {
  return new Request("http://localhost/app/api/branding/logo?v=abc123", {
    headers,
  });
}

const LOGO = new Uint8Array([1, 2, 3, 4]);

function upstreamLogo(status = 200): Response {
  return new Response(status === 200 ? LOGO : null, {
    status,
    headers: {
      "Content-Type": "image/svg+xml",
      ETag: '"abc123"',
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

describe("branding logo proxy", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("streams the image back with the modulith's caching and hardening headers", async () => {
    fetchMock.mockResolvedValue(upstreamLogo());

    const response = await GET(request({ host: "portal.example.com" }));

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/branding/portal.example.com/logo",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expect(response.headers.get("etag")).toBe('"abc123"');
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; sandbox",
    );
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(LOGO);
  });

  it("takes the domain from the headers and ignores the query string", async () => {
    fetchMock.mockResolvedValue(upstreamLogo());

    const spoofed = new Request(
      "http://localhost/app/api/branding/logo?domain=evil.example",
      { headers: { host: "portal.example.com" } },
    );
    await GET(spoofed);

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/branding/portal.example.com/logo",
    );
  });

  it("forwards If-None-Match and relays a 304", async () => {
    fetchMock.mockResolvedValue(upstreamLogo(304));

    const response = await GET(
      request({ host: "portal.example.com", "if-none-match": '"abc123"' }),
    );

    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "If-None-Match": '"abc123"',
    });
    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('"abc123"');
  });

  it("relays a 404 for a domain with no branding", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    const response = await GET(request({ host: "portal.example.com" }));
    expect(response.status).toBe(404);
  });

  it("answers 502 when the modulith is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await GET(request({ host: "portal.example.com" }));
    expect(response.status).toBe(502);
  });

  it.each([
    ["a malformed host", { host: "not..a..domain" }],
    ["no host at all", {}],
  ])("answers 404 without calling the modulith for %s", async (_l, headers) => {
    const response = await GET(request(headers));
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks upstream for the dark variant when the query says so", async () => {
    fetchMock.mockResolvedValue(upstreamLogo());

    await GET(
      new Request("http://localhost/app/api/branding/logo?v=abc&variant=dark", {
        headers: { host: "portal.example.com" },
      }),
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://modulith:8180/branding/portal.example.com/logo/dark",
    );
  });

  it.each(["light", "DARK", "../dark", ""])(
    "treats %s as the light logo rather than passing it upstream",
    async (variant) => {
      fetchMock.mockResolvedValue(upstreamLogo());

      await GET(
        new Request(
          `http://localhost/app/api/branding/logo?variant=${encodeURIComponent(variant)}`,
          { headers: { host: "portal.example.com" } },
        ),
      );

      expect(fetchMock.mock.calls[0][0]).toBe(
        "http://modulith:8180/branding/portal.example.com/logo",
      );
    },
  );

  it("relays a 404 for a domain that ships no dark logo", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

    const response = await GET(
      new Request("http://localhost/app/api/branding/logo?variant=dark", {
        headers: { host: "portal.example.com" },
      }),
    );

    expect(response.status).toBe(404);
  });
});
