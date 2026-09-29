import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import type { DashboardOperationRequest } from "../seams/operations";
import {
  createHttpGetOperationExecutor,
  type ResolvedHttpGetOperation,
} from "./http-get";

const request = (): DashboardOperationRequest => ({
  identity: {
    tenantId: "acme",
    userId: "viewer",
    kind: "user",
    capabilities: NO_CAPABILITIES,
  },
  ref: { tenantId: "acme", scopeId: "ops", slug: "telemetry" },
  connectionId: "telemetry",
  operationId: "summary",
  parameters: { days: 14 },
  signal: new AbortController().signal,
  limits: { maxRows: 5, maxBytes: 4096 },
});
const operation = (): ResolvedHttpGetOperation => ({
  url: "https://data.example/rpc/summary",
  readOnly: true,
  parameterTypes: { days: "number" },
  parameters: { days: 14 },
  isolation: { tenantParameter: "tenant", tenantValue: "verified-tenant-code" },
  headers: { authorization: "Bearer private-token" },
});
function setup(
  plan: unknown = operation(),
  response = Response.json([{ count: 3 }]),
) {
  const resolve = vi.fn(async () => plan as ResolvedHttpGetOperation);
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
  const executor = createHttpGetOperationExecutor({
    resolve,
    fetchImpl,
    allowedOrigins: ["https://data.example"],
  });
  return { executor, resolve, fetchImpl };
}
describe("portable HTTP GET operation execution", () => {
  it("executes a resolved read-only RPC with server-enforced tenant and private credential", async () => {
    const { executor, fetchImpl } = setup();
    expect(await executor.execute(request())).toEqual({ rows: [{ count: 3 }] });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://data.example/rpc/summary?days=14&tenant=verified-tenant-code",
    );
    expect(init).toMatchObject({ method: "GET", redirect: "error" });
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer private-token",
    );
  });
  it.each([
    null,
    { ...operation(), readOnly: false },
    { ...operation(), url: "https://other.example/rpc/summary" },
    { ...operation(), url: "https://private-token@data.example/rpc/summary" },
    { ...operation(), url: "https://data.example/rpc/summary?tenant=attacker" },
    { ...operation(), url: "https://data.example/rpc/summary#fragment" },
    { ...operation(), parameters: { days: "14" } },
    { ...operation(), parameters: { days: 14, extra: true } },
    { ...operation(), parameters: {} },
    {
      ...operation(),
      parameterTypes: { days: "number", tenant: "string" },
      parameters: { days: 14, tenant: "attacker" },
    },
    { ...operation(), isolation: {} },
    { ...operation(), headers: { host: "other.example" } },
  ])("rejects untrusted plans before network access %#", async (plan) => {
    const { executor, fetchImpl } = setup(plan);
    await expect(executor.execute(request())).rejects.toMatchObject({
      message: "Dashboard query could not be completed",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("allows a host-attested credential-isolated operation", async () => {
    const { executor, fetchImpl } = setup({
      ...operation(),
      isolation: { credentialScoped: true },
    });
    await executor.execute(request());
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(
      "https://data.example/rpc/summary?days=14",
    );
  });
  it.each([302, 403, 500, 206])(
    "refuses status %s without exposing provider diagnostics",
    async (status) => {
      const { executor } = setup(
        operation(),
        new Response("private-token", { status }),
      );
      await expect(executor.execute(request())).rejects.toMatchObject({
        message: "Dashboard query could not be completed",
      });
    },
  );
  it.each(
    [
      [{ nested: { secret: true } }],
      Array.from({ length: 6 }, () => ({ count: 1 })),
      { rows: [] },
    ].map((body) => ({ body })),
  )("rejects invalid or excess rows %#", async ({ body }) => {
    await expect(
      setup(operation(), Response.json(body)).executor.execute(request()),
    ).rejects.toThrow("could not be completed");
  });
  it.each(["0-0/5", "0-0/*", "1-1/1"])(
    "rejects incomplete Content-Range %s",
    async (range) => {
      await expect(
        setup(
          operation(),
          Response.json([{ count: 3 }], {
            headers: { "content-range": range },
          }),
        ).executor.execute(request()),
      ).rejects.toThrow("could not be completed");
    },
  );
  it.each([
    [[], "*/0"],
    [[{ count: 3 }], "0-0/1"],
  ] as const)(
    "accepts complete PostgREST result ranges %#",
    async (rows, range) => {
      expect(
        await setup(
          operation(),
          Response.json(rows, { headers: { "content-range": range } }),
        ).executor.execute(request()),
      ).toEqual({ rows });
    },
  );
  it("bounds streamed bytes even without Content-Length", async () => {
    const response = new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(4097));
          controller.close();
        },
      }),
    );
    await expect(
      setup(operation(), response).executor.execute(request()),
    ).rejects.toThrow("could not be completed");
  });
  it("denies tenant mismatch, invalid limits and cancellation before resolving credentials", async () => {
    const { executor, resolve } = setup();
    for (const input of [
      { ...request(), ref: { ...request().ref, tenantId: "other" } },
      { ...request(), limits: { maxRows: 5001, maxBytes: 4096 } },
      { ...request(), signal: AbortSignal.abort() },
    ])
      await expect(executor.execute(input)).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
  });
  it("propagates the deadline to a hanging upstream and releases the slot", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async (_url, init) =>
        new Promise((_resolve, reject) =>
          init!.signal!.addEventListener(
            "abort",
            () => reject(new Error("private-token")),
            { once: true },
          ),
        ),
    );
    const executor = createHttpGetOperationExecutor({
      resolve: async () => operation(),
      fetchImpl,
      allowedOrigins: ["https://data.example"],
      timeoutMs: 10,
    });
    await expect(executor.execute(request())).rejects.toMatchObject({
      message: "Dashboard query could not be completed",
    });
    fetchImpl.mockResolvedValue(Response.json([]));
    expect(await executor.execute(request())).toEqual({ rows: [] });
  });
  it.each(
    [
      [],
      ["http://public.example"],
      ["https://data.example/path"],
      ["https://data.example?x=1"],
      ["ftp://127.0.0.1"],
    ].map((allowedOrigins) => ({ allowedOrigins })),
  )("rejects unsafe origin configuration %#", ({ allowedOrigins }) => {
    expect(() =>
      createHttpGetOperationExecutor({
        resolve: async () => operation(),
        allowedOrigins,
      }),
    ).toThrow(TypeError);
  });
});
