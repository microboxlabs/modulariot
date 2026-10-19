import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sseFrame, watchIdle } from "./stream-watchdog";

const IDLE = 1_000;

function source(): {
  stream: ReadableStream<Uint8Array>;
  push: (text: string) => void;
} {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    stream,
    push: (text) => controller.enqueue(new TextEncoder().encode(text)),
  };
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

describe("watchIdle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("passes the bytes through and ends with the frame the check returns", async () => {
    const { stream, push } = source();
    const onIdle = vi.fn(async () =>
      sseFrame({ type: "RUN_ERROR", message: "interrupted" })
    );
    const reading = readAll(watchIdle(stream, IDLE, onIdle));

    push('data: {"type":"RUN_STARTED"}\n\n');
    await vi.advanceTimersByTimeAsync(IDLE);

    expect(await reading).toBe(
      'data: {"type":"RUN_STARTED"}\n\ndata: {"type":"RUN_ERROR","message":"interrupted"}\n\n'
    );
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it("does not check while keepalives arrive, and keeps waiting when told to", async () => {
    const { stream, push } = source();
    const onIdle = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        sseFrame({ type: "RUN_ERROR", message: "interrupted" })
      );
    const reading = readAll(watchIdle(stream, IDLE, onIdle));

    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(IDLE - 100);
      push(": keepalive\n\n");
    }
    expect(onIdle).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(IDLE);
    expect(onIdle).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(IDLE);

    expect(await reading).toContain("RUN_ERROR");
    expect(onIdle).toHaveBeenCalledTimes(2);
  });
});
