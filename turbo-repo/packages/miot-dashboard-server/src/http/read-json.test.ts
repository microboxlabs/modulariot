import { describe, expect, it, vi } from "vitest";
import { readJsonBody } from "./read-json";

const request = (body?: RequestInit["body"], headers?: RequestInit["headers"]) =>
  new Request("https://dashboard.test", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);

describe("bounded JSON body decoding", () => {
  it("accepts the exact byte limit, including split Unicode sequences", async () => {
    const bytes = new TextEncoder().encode('{"value":"😀"}');
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const value of bytes) controller.enqueue(Uint8Array.of(value));
        controller.close();
      },
    });
    expect(await readJsonBody(request(body), bytes.length)).toEqual({
      value: "😀",
    });
    await expect(
      readJsonBody(request(bytes), bytes.length - 1),
    ).rejects.toMatchObject({ status: 413 });
  });

  it("enforces actual bytes with absent or misleading Content-Length", async () => {
    for (const headers of [undefined, { "content-length": "1" }]) {
      await expect(
        readJsonBody(request('{"large":true}', headers), 5),
      ).rejects.toMatchObject({ status: 413 });
    }
  });

  it("stops consuming and cancels an oversized stream", async () => {
    const cancel = vi.fn();
    let reads = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          reads += 1;
          controller.enqueue(new Uint8Array(20));
        },
        cancel,
      },
      { highWaterMark: 0 },
    );
    await expect(readJsonBody(request(body), 10)).rejects.toMatchObject({
      status: 413,
    });
    expect(reads).toBe(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("redacts malformed JSON, UTF-8 and stream errors", async () => {
    const broken = new ReadableStream({
      start(controller) {
        controller.error(new Error("private stream details"));
      },
    });
    for (const body of [undefined, "not JSON", Uint8Array.of(255), broken]) {
      await expect(readJsonBody(request(body), 100)).rejects.toMatchObject({
        status: 400,
        message: "Request body must be valid JSON",
      });
    }
  });
});
