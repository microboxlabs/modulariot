import { describe, expect, it, vi } from "vitest";
import { MIN_PROXY_KEY_LENGTH } from "../identity/proxy";
import { createHttpCredentialsVault } from "./http";

const URL_TEMPLATE =
  "https://modulith.example.com/api/v1/internal/tenants/{tenantId}/credentials/{credentialRef}";
const KEY = "k".repeat(MIN_PROXY_KEY_LENGTH);

const AUTH = {
  kind: "HTTP_AUTH",
  headers: { Authorization: "Bearer from-the-host" },
  queryParams: {},
};

function respond(
  status: number,
  body?: unknown,
): (url: URL | string, init?: RequestInit) => Promise<Response> {
  return () =>
    Promise.resolve(
      new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
    );
}

const build = (
  fetchImpl: typeof fetch,
  overrides: Partial<Parameters<typeof createHttpCredentialsVault>[0]> = {},
) =>
  createHttpCredentialsVault({
    url: URL_TEMPLATE,
    proxyKey: KEY,
    fetchImpl,
    ...overrides,
  });

describe("configuration", () => {
  it("refuses a URL missing a placeholder", () => {
    expect(() =>
      createHttpCredentialsVault({
        url: "https://modulith.example.com/credentials/{credentialRef}",
        proxyKey: KEY,
      }),
    ).toThrow(/tenantId/);
  });

  it("refuses a URL that is not https", () => {
    expect(() =>
      createHttpCredentialsVault({
        url: "http://modulith.example.com/{tenantId}/{credentialRef}",
        proxyKey: KEY,
      }),
    ).toThrow(/https/);
  });

  it("refuses a key short enough to guess", () => {
    expect(() =>
      createHttpCredentialsVault({ url: URL_TEMPLATE, proxyKey: "short" }),
    ).toThrow(/at least/);
  });
});

describe("resolving", () => {
  it("sends the key and returns the applied auth", async () => {
    const fetchImpl = vi.fn(respond(200, AUTH)) as unknown as typeof fetch;
    const vault = build(fetchImpl);

    await expect(vault.resolve("acme", "fleet")).resolves.toEqual(AUTH);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe(
      "/api/v1/internal/tenants/acme/credentials/fleet",
    );
    expect((init.headers as Record<string, string>)["x-miot-proxy-key"]).toBe(
      KEY,
    );
  });

  it("percent-encodes both path parts", async () => {
    const fetchImpl = vi.fn(respond(200, AUTH)) as unknown as typeof fetch;
    await build(fetchImpl).resolve("a/b", "c d");

    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [URL];
    expect(url.pathname).toBe(
      "/api/v1/internal/tenants/a%2Fb/credentials/c%20d",
    );
  });

  it("reads 404 as no such credential", async () => {
    const vault = build(respond(404) as unknown as typeof fetch);
    await expect(vault.resolve("acme", "missing")).resolves.toBeNull();
  });

  it("raises on 403, because that is our own key being refused", async () => {
    const vault = build(respond(403) as unknown as typeof fetch);
    // Not null: a misconfigured key must be visible as a failure, not read
    // as "this datasource has no credential".
    await expect(vault.resolve("acme", "fleet")).rejects.toThrow(/403/);
  });

  it("raises on 500", async () => {
    const vault = build(respond(500) as unknown as typeof fetch);
    await expect(vault.resolve("acme", "fleet")).rejects.toThrow(/500/);
  });

  it("raises on an answer it does not recognize", async () => {
    const vault = build(
      respond(200, { kind: "MAGIC" }) as unknown as typeof fetch,
    );
    await expect(vault.resolve("acme", "fleet")).rejects.toThrow(
      /unrecognized kind/,
    );
  });

  it("raises rather than putting a non-string in a header", async () => {
    const vault = build(
      respond(200, {
        kind: "HTTP_AUTH",
        headers: { Authorization: 42 },
      }) as unknown as typeof fetch,
    );
    await expect(vault.resolve("acme", "fleet")).rejects.toThrow(/non-string/);
  });

  it("names a missing field without quoting its value", async () => {
    const vault = build(
      respond(200, {
        kind: "SERVICE_ACCOUNT",
        projectId: "p",
        clientEmail: "e",
      }) as unknown as typeof fetch,
    );
    await expect(vault.resolve("acme", "fleet")).rejects.toThrow(
      /without "privateKey"/,
    );
  });
});

describe("caching", () => {
  it("asks once for repeated resolutions", async () => {
    const fetchImpl = vi.fn(respond(200, AUTH)) as unknown as typeof fetch;
    const vault = build(fetchImpl);

    await vault.resolve("acme", "fleet");
    await vault.resolve("acme", "fleet");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("shares one call between concurrent resolutions", async () => {
    const fetchImpl = vi.fn(respond(200, AUTH)) as unknown as typeof fetch;
    const vault = build(fetchImpl);

    await Promise.all([
      vault.resolve("acme", "fleet"),
      vault.resolve("acme", "fleet"),
      vault.resolve("acme", "fleet"),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("keeps tenants on separate keys", async () => {
    const fetchImpl = vi.fn(respond(200, AUTH)) as unknown as typeof fetch;
    const vault = build(fetchImpl);

    await vault.resolve("acme", "fleet");
    await vault.resolve("globex", "fleet");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not reuse past the expiry the host stated", async () => {
    let clock = 1_000_000;
    const fetchImpl = vi.fn(
      respond(200, {
        ...AUTH,
        expiresAt: new Date(clock + 5_000).toISOString(),
      }),
    ) as unknown as typeof fetch;
    const vault = build(fetchImpl, { now: () => clock });

    await vault.resolve("acme", "fleet");
    clock += 4_000;
    await vault.resolve("acme", "fleet");
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock += 2_000;
    await vault.resolve("acme", "fleet");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("caps reuse at the ceiling even when the host says otherwise", async () => {
    let clock = 1_000_000;
    const fetchImpl = vi.fn(
      respond(200, {
        ...AUTH,
        // A year out. Honouring this would keep a revoked credential alive.
        expiresAt: new Date(clock + 31_536_000_000).toISOString(),
      }),
    ) as unknown as typeof fetch;
    const vault = build(fetchImpl, { now: () => clock, maxCacheSeconds: 10 });

    await vault.resolve("acme", "fleet");
    clock += 11_000;
    await vault.resolve("acme", "fleet");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("never caches a failure", async () => {
    let attempt = 0;
    const fetchImpl = vi.fn(() => {
      attempt += 1;
      return attempt === 1
        ? Promise.resolve(new Response(null, { status: 500 }))
        : Promise.resolve(
            new Response(JSON.stringify(AUTH), {
              status: 200,
              headers: { "content-type": "application/json" },
            }),
          );
    }) as unknown as typeof fetch;
    const vault = build(fetchImpl);

    await expect(vault.resolve("acme", "fleet")).rejects.toThrow();
    await expect(vault.resolve("acme", "fleet")).resolves.toEqual(AUTH);
  });
});
