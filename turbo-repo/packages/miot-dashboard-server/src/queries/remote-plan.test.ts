import { describe, expect, it, vi } from "vitest";
import { NO_CAPABILITIES } from "../seams/identity";
import type { DashboardOperationRequest } from "../seams/operations";
import { createRemotePlanOperationExecutor } from "./remote-plan";
const key = "service-key-".repeat(4);
const input = (): DashboardOperationRequest => ({
  identity: {
    tenantId: "acme",
    userId: "viewer",
    kind: "user",
    capabilities: NO_CAPABILITIES,
  },
  ref: { tenantId: "acme", scopeId: "ops", slug: "summary" },
  connectionId: "connection",
  operationId: "operation",
  parameters: {},
  limits: { maxRows: 10, maxBytes: 4096 },
  signal: new AbortController().signal,
});
const httpPlan = {
  kind: "HTTP_GET",
  operation: {
    url: "https://data.example/rpc/summary",
    readOnly: true,
    parameterTypes: {},
    parameters: {},
    isolation: { tenantParameter: "tenant", tenantValue: "ACME" },
    headers: { authorization: "Bearer data-token" },
  },
};
const config = {
  url: "https://catalog.example/internal/dashboard-operations/resolve",
  proxyKey: key,
  allowedDataOrigins: ["https://data.example"],
};
describe("remote catalog resolution with portable local execution", () => {
  it("keeps service credentials separate and returns only data rows", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(httpPlan))
      .mockResolvedValueOnce(Response.json([{ count: 1 }]));
    const result = await createRemotePlanOperationExecutor({
      ...config,
      fetchImpl,
    }).execute(input());
    expect(result).toEqual({ rows: [{ count: 1 }] });
    const [catalogUrl, catalogRequest] = fetchImpl.mock.calls[0]!;
    expect(String(catalogUrl)).toBe(config.url);
    expect(catalogRequest).toMatchObject({ method: "POST", redirect: "error" });
    expect(JSON.parse(String(catalogRequest?.body))).toMatchObject({
      tenantId: "acme",
      userId: "viewer",
      connectionId: "connection",
    });
    expect(new Headers(catalogRequest?.headers).get("x-miot-proxy-key")).toBe(
      key,
    );
    const [dataUrl, dataRequest] = fetchImpl.mock.calls[1]!;
    expect(String(dataUrl)).toBe(
      "https://data.example/rpc/summary?tenant=ACME",
    );
    expect(dataRequest?.method).toBe("GET");
    expect(
      new Headers(dataRequest?.headers).get("x-miot-proxy-key"),
    ).toBeNull();
    expect(new Headers(dataRequest?.headers).get("authorization")).toBe(
      "Bearer data-token",
    );
  });
  it("resolves BigQuery credentials then executes Google jobs locally", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          kind: "BIGQUERY",
          operation: {
            plan: {
              projectId: "billing-project",
              location: "US",
              sql: "SELECT 1 AS count",
              maximumBytesBilled: 1000,
              parameterTypes: {},
            },
            parameters: {},
            accessToken: "google-token",
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          statistics: {
            totalBytesProcessed: "1",
            query: { statementType: "SELECT" },
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({}))
      .mockResolvedValueOnce(
        Response.json({
          jobComplete: true,
          totalRows: "1",
          schema: { fields: [{ name: "count", type: "INTEGER" }] },
          rows: [{ f: [{ v: "1" }] }],
        }),
      );
    expect(
      await createRemotePlanOperationExecutor({
        ...config,
        allowedDataOrigins: [],
        fetchImpl,
      }).execute(input()),
    ).toEqual({ rows: [{ count: "1" }] });
    for (const [url, init] of fetchImpl.mock.calls.slice(1)) {
      expect(new URL(String(url)).origin).toBe(
        "https://bigquery.googleapis.com",
      );
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer google-token",
      );
      expect(new Headers(init?.headers).get("x-miot-proxy-key")).toBeNull();
    }
  });
  it.each([
    null,
    {},
    { kind: "WRITE", operation: {} },
    { kind: "HTTP_GET", operation: null },
    {
      kind: "HTTP_GET",
      operation: { ...httpPlan.operation, url: "https://evil.example" },
    },
  ])("refuses unrecognized or unsafe catalog plans %#", async (plan) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(plan));
    await expect(
      createRemotePlanOperationExecutor({ ...config, fetchImpl }).execute(
        input(),
      ),
    ).rejects.toMatchObject({
      message: "Dashboard query could not be completed",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("rejects tenant mismatch and invalid limits before sending credentials", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const executor = createRemotePlanOperationExecutor({
      ...config,
      fetchImpl,
    });
    await expect(
      executor.execute({
        ...input(),
        ref: { ...input().ref, tenantId: "other" },
      }),
    ).rejects.toThrow();
    await expect(
      executor.execute({ ...input(), limits: { maxRows: 0, maxBytes: 4096 } }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it.each([302, 401, 500])(
    "refuses catalog status %s without exposing its body",
    async (status) => {
      const fetchImpl = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("private-token", { status }));
      await expect(
        createRemotePlanOperationExecutor({ ...config, fetchImpl }).execute(
          input(),
        ),
      ).rejects.toMatchObject({
        message: "Dashboard query could not be completed",
      });
    },
  );
  it("bounds plan responses before buffering", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("x".repeat(512 * 1024 + 1)));
    await expect(
      createRemotePlanOperationExecutor({ ...config, fetchImpl }).execute(
        input(),
      ),
    ).rejects.toThrow("could not be completed");
  });
  it("bounds catalog requests before network access", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      createRemotePlanOperationExecutor({ ...config, fetchImpl }).execute({
        ...input(),
        parameters: { oversized: "x".repeat(512 * 1024) },
      }),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("cancels a hanging catalog request at the overall deadline", async () => {
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
    await expect(
      createRemotePlanOperationExecutor({
        ...config,
        fetchImpl,
        timeoutMs: 10,
      }).execute(input()),
    ).rejects.toMatchObject({
      message: "Dashboard query could not be completed",
    });
  });
  it("sanitizes malformed service credentials at startup", () => {
    expect(() =>
      createRemotePlanOperationExecutor({
        ...config,
        proxyKey: key + "\nprivate-token",
      }),
    ).toThrow(new TypeError("Invalid plan service credential"));
  });
  it.each([
    { ...config, proxyKey: "short" },
    { ...config, url: "https://secret@catalog.example" },
    { ...config, timeoutMs: 20001 },
    { ...config, allowedDataOrigins: ["http://data.example"] },
  ])("rejects invalid operator configuration %#", (options) => {
    expect(() => createRemotePlanOperationExecutor(options)).toThrow(TypeError);
  });
});
