import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { toNodeListener } from "./node-adapter";

async function listen(handler: (request: Request) => Promise<Response>) {
  const onError = vi.fn();
  const server = createServer(toNodeListener(handler, { onError }));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("Expected a TCP address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    onError,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

describe("standalone request cancellation", () => {
  it("aborts the handler signal when the caller disconnects during execution", async () => {
    let started!: (signal: AbortSignal) => void;
    const ready = new Promise<AbortSignal>((resolve) => {
      started = resolve;
    });
    let settled!: () => void;
    const finished = new Promise<void>((resolve) => {
      settled = resolve;
    });
    const running = await listen(async (request) => {
      started(request.signal);
      await new Promise<void>((resolve) =>
        request.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      settled();
      return new Response("cancelled");
    });
    try {
      const caller = httpRequest(running.url, { method: "POST" });
      caller.on("error", () => {});
      caller.end("{}");
      const signal = await ready;
      expect(signal.aborted).toBe(false);
      caller.destroy();
      await finished;
      expect(signal.aborted).toBe(true);
      expect(running.onError).not.toHaveBeenCalled();
    } finally {
      await running.close();
    }
  });

  it("keeps successfully completed requests un-aborted", async () => {
    let signal: AbortSignal | undefined;
    const running = await listen(async (request) => {
      signal = request.signal;
      return new Response("complete");
    });
    try {
      const response = await fetch(running.url, {
        headers: { connection: "close" },
      });
      expect(await response.text()).toBe("complete");
      expect(signal?.aborted).toBe(false);
    } finally {
      await running.close();
    }
    expect(signal?.aborted).toBe(false);
  });

  it("does not try to send or log an error after a disconnected handler rejects", async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let settled!: () => void;
    const finished = new Promise<void>((resolve) => {
      settled = resolve;
    });
    const running = await listen(async (request) => {
      started();
      await new Promise<void>((resolve) =>
        request.signal.addEventListener("abort", () => resolve(), { once: true }),
      );
      settled();
      throw new Error("cancelled upstream");
    });
    try {
      const caller = httpRequest(running.url);
      caller.on("error", () => {});
      caller.end();
      await ready;
      caller.destroy();
      await finished;
      expect(running.onError).not.toHaveBeenCalled();
    } finally {
      await running.close();
    }
  });
});
