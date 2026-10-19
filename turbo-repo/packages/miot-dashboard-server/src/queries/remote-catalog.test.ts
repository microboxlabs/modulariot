import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import { createRemoteQueryCatalog } from "./remote-catalog";

const key = "service-key-".repeat(4);
const url = "https://catalog.example/internal/dashboard-operations/catalog";
const request = (tenantId = "acme") => ({
  identity: { tenantId, userId: "editor", kind: "user" as const, capabilities: NO_CAPABILITIES },
  ref: { tenantId: "acme", scopeId: "ops", slug: "summary" },
  signal: new AbortController().signal,
});
const listing = {
  connections: [
    { id: "pgrest", label: "PostgREST", operations: [{ id: "op-1", label: "fn_summary" }] },
  ],
};

describe("createRemoteQueryCatalog", () => {
  it("asks for the dashboard's tenant with the service key and returns names and ids only", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        connections: [
          { ...listing.connections[0], baseUrl: "https://secret", operations: [{ id: "op-1", label: "fn_summary", path: "/rpc/x" }] },
        ],
      }),
    );
    const result = await createRemoteQueryCatalog({ url, proxyKey: key, fetchImpl }).list(request());
    expect(result).toEqual(listing.connections);
    const [called, init] = fetchImpl.mock.calls[0]!;
    expect(String(called)).toBe(url);
    expect(init).toMatchObject({ method: "POST", redirect: "error" });
    expect(new Headers(init?.headers).get("x-miot-proxy-key")).toBe(key);
    expect(JSON.parse(String(init?.body))).toEqual({ tenantId: "acme" });
  });

  it.each([
    ["an upstream error", () => new Response("secret detail", { status: 500 })],
    ["a malformed listing", () => Response.json({ connections: [{ id: "x" }] })],
    ["no listing", () => Response.json([])],
  ])("refuses %s without forwarding details", async (_, reply) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(reply());
    await expect(
      createRemoteQueryCatalog({ url, proxyKey: key, fetchImpl }).list(request()),
    ).rejects.not.toThrow(/secret/);
  });

  it("refuses a caller from another tenant before calling the host", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      createRemoteQueryCatalog({ url, proxyKey: key, fetchImpl }).list(request("other")),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses weak configuration at startup", () => {
    expect(() => createRemoteQueryCatalog({ url, proxyKey: "short" })).toThrow();
    expect(() =>
      createRemoteQueryCatalog({ url: "http://catalog.example/x", proxyKey: key }),
    ).toThrow();
  });
});
