import { describe, expect, it } from "vitest";
import { parseSSE, type SSEFrame } from "../harness/sse.js";

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const queue = chunks.map((c) => enc.encode(c));
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
  });
}

async function collect(
  iter: AsyncIterable<SSEFrame>,
): Promise<SSEFrame[]> {
  const out: SSEFrame[] = [];
  for await (const f of iter) out.push(f);
  return out;
}

describe("parseSSE", () => {
  it("parses a single complete event", async () => {
    const stream = streamOf([
      "id: evt_1\nevent: run.started\ndata: {\"id\":\"evt_1\"}\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([
      { id: "evt_1", event: "run.started", data: '{"id":"evt_1"}' },
    ]);
  });

  it("survives chunk boundaries mid-line", async () => {
    const stream = streamOf([
      "id: evt_",
      "1\nevent: run.st",
      "arted\ndata: {\"id\":\"e",
      "vt_1\"}\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([
      { id: "evt_1", event: "run.started", data: '{"id":"evt_1"}' },
    ]);
  });

  it("handles multiple back-to-back events", async () => {
    const stream = streamOf([
      "id: a\nevent: run.started\ndata: {}\n\n",
      "id: b\nevent: run.completed\ndata: {}\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames.map((f) => f.event)).toEqual([
      "run.started",
      "run.completed",
    ]);
    expect(frames.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("joins multi-line data fields with newlines", async () => {
    const stream = streamOf([
      "event: x\ndata: line1\ndata: line2\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([{ event: "x", data: "line1\nline2" }]);
  });

  it("ignores comment lines starting with ':'", async () => {
    const stream = streamOf([
      ": ping\nid: evt_1\nevent: run.started\ndata: {}\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([
      { id: "evt_1", event: "run.started", data: "{}" },
    ]);
  });

  it("parses the harness error frame as a regular SSEFrame", async () => {
    const stream = streamOf([
      "event: error\ndata: {\"error\":\"unknown_run_id\",\"run_id\":\"run_x\"}\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toHaveLength(1);
    expect(frames[0]?.event).toBe("error");
    expect(JSON.parse(frames[0]?.data ?? "{}")).toEqual({
      error: "unknown_run_id",
      run_id: "run_x",
    });
  });

  it("strips a single leading space after the colon", async () => {
    const stream = streamOf([
      "id:evt_1\nevent: run.started\ndata:  two-spaces\n\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([
      { id: "evt_1", event: "run.started", data: " two-spaces" },
    ]);
  });

  it("handles CRLF line endings", async () => {
    const stream = streamOf([
      "id: evt_1\r\nevent: run.started\r\ndata: {}\r\n\r\n",
    ]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([
      { id: "evt_1", event: "run.started", data: "{}" },
    ]);
  });

  it("emits nothing when the stream is just blank lines", async () => {
    const stream = streamOf(["\n\n\n"]);
    const frames = await collect(parseSSE(stream));
    expect(frames).toEqual([]);
  });
});
