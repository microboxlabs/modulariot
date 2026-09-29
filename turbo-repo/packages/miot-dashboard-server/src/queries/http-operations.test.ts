import { describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import { NO_CAPABILITIES } from "../seams/identity";
import type { DashboardOperationRequest } from "../seams/operations";
import { createHttpDashboardOperationExecutor } from "./http-operations";

const proxyKey = "test-service-key-".repeat(3);
const request = (): DashboardOperationRequest => ({
  identity: {
    tenantId: "acme",
    userId: "alice",
    kind: "user",
    capabilities: NO_CAPABILITIES,
  },
  ref: { tenantId: "acme", scopeId: "ops", slug: "costs" },
  connectionId: "billing",
  operationId: "summary",
  parameters: { days: 30 },
  signal: new AbortController().signal,
  limits: { maxRows: 5, maxBytes: 1024 },
});
const setup = (response = Response.json({ rows: [{ cost: 12 }] })) => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
  const executor = createHttpDashboardOperationExecutor({
    url: "https://host.test/internal/dashboard-operations",
    proxyKey,
    fetchImpl,
  });
  return { executor, fetchImpl };
};

describe("host HTTP operation executor", () => {
  it("sends only authorized context and bindings to a fixed endpoint", async () => {
    const { executor, fetchImpl } = setup(
      Response.json({ rows: [{ cost: 12 }], privateMetadata: "discard" }),
    );
    expect(await executor.execute(request())).toEqual({
      rows: [{ cost: 12 }],
    });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://host.test/internal/dashboard-operations",
    );
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect(new Headers(init?.headers).get("cache-control")).toBe("no-store");
    expect(new Headers(init?.headers).get("x-miot-proxy-key")).toBe(proxyKey);
    expect(JSON.parse(String(init?.body))).toEqual({
      tenantId: "acme",
      scopeId: "ops",
      dashboardSlug: "costs",
      userId: "alice",
      connectionId: "billing",
      operationId: "summary",
      parameters: { days: 30 },
      limits: { maxRows: 5, maxBytes: 1024 },
    });
  });

  it("rejects a mismatched tenant before network access", async () => {
    const { executor, fetchImpl } = setup();
    const input = request();
    input.ref.tenantId = "other";
    await expect(executor.execute(input)).rejects.toMatchObject({
      status: 502,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([301, 401, 403, 404, 500])(
    "redacts host status %s and cancels its unread body",
    async (status) => {
      const cancel = vi.fn();
      const response = new Response(new ReadableStream({ cancel }), {
        status,
      });
      const { executor } = setup(response);
      await expect(executor.execute(request())).rejects.toMatchObject({
        status: 502,
        message: "Dashboard query could not be completed",
      });
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it.each([
    null,
    [],
    { rows: [null] },
    { rows: [{ nested: {} }] },
    { rows: Array(6).fill({}) },
  ])("rejects malformed host rows %j", async (body) => {
    await expect(
      setup(Response.json(body)).executor.execute(request()),
    ).rejects.toMatchObject({ status: 502 });
  });

  it("bounds actual response bytes before parsing even with a false content length", async () => {
    const cancel = vi.fn();
    let reads = 0;
    const response = new Response(
      new ReadableStream(
        {
          pull(controller) {
            reads++;
            controller.enqueue(new Uint8Array(1025));
          },
          cancel,
        },
        { highWaterMark: 0 },
      ),
      { headers: { "content-length": "1" } },
    );
    await expect(
      setup(response).executor.execute(request()),
    ).rejects.toMatchObject({ status: 502 });
    expect(reads).toBe(1);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("redacts malformed JSON and network failures", async () => {
    await expect(
      setup(new Response("secret invalid JSON")).executor.execute(request()),
    ).rejects.toMatchObject({
      status: 502,
      message: "Dashboard query could not be completed",
    });
    const { executor, fetchImpl } = setup();
    fetchImpl.mockRejectedValueOnce(new Error("secret host details"));
    await expect(executor.execute(request())).rejects.toMatchObject({
      status: 502,
      message: "Dashboard query could not be completed",
    });
  });

  it("propagates caller cancellation and skips already aborted requests", async () => {
    const { executor, fetchImpl } = setup();
    const controller = new AbortController();
    fetchImpl.mockImplementationOnce(async (_url, init) => {
      controller.abort();
      expect(init?.signal?.aborted).toBe(true);
      throw new Error("aborted");
    });
    await expect(
      executor.execute({ ...request(), signal: controller.signal }),
    ).rejects.toMatchObject({ status: 502 });
    await expect(
      executor.execute({ ...request(), signal: controller.signal }),
    ).rejects.toMatchObject({ status: 502 });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("aborts a real host response stalled after headers at its deadline", async () => {
    const host = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.write('{"rows":[');
    });
    host.listen(0, "127.0.0.1");
    await once(host, "listening");
    const address = host.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected a TCP address");
    const executor = createHttpDashboardOperationExecutor({
      url: `http://127.0.0.1:${address.port}/operations`,
      proxyKey,
      requestTimeoutMs: 100,
    });
    try {
      await expect(executor.execute(request())).rejects.toMatchObject({
        status: 502,
        message: "Dashboard query could not be completed",
      });
    } finally {
      host.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        host.close((error) => error ? reject(error) : resolve()),
      );
    }
  });

  it.each([
    { url: "http://host.test" },
    { url: "ftp://localhost" },
    { url: "https://user:secret@host.test" },
    { url: "https://host.test/#fragment" },
    { url: "not a URL" },
    { proxyKey: "short" },
    { requestTimeoutMs: 0 },
    { requestTimeoutMs: 2147483648 },
  ])("refuses unsafe endpoint configuration %j", (override) => {
    expect(() =>
      createHttpDashboardOperationExecutor({
        url: "https://host.test",
        proxyKey,
        ...override,
      }),
    ).toThrow(TypeError);
  });

  it("allows explicit private-network HTTP and loopback development", () => {
    expect(() =>
      createHttpDashboardOperationExecutor({
        url: "http://modulith:8080/internal/dashboard-operations",
        proxyKey,
        allowHttp: true,
      }),
    ).not.toThrow();
    expect(() =>
      createHttpDashboardOperationExecutor({
        url: "http://localhost:8080/internal/dashboard-operations",
        proxyKey,
      }),
    ).not.toThrow();
  });
});
