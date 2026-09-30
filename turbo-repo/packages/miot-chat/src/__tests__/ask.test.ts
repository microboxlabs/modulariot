import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HarnessEvent } from "@microboxlabs/miot-harness-client";
import type { ResolvedConfig } from "../config.js";

const create = vi.fn(async () => ({ run_id: "r1" }));

vi.mock("@microboxlabs/miot-harness-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@microboxlabs/miot-harness-client")>();
  return {
    ...actual,
    createMiotHarnessClient: () => ({
      runs: {
        create,
        stream: async function* (): AsyncGenerator<HarnessEvent> {
          yield {
            id: "e1",
            run_id: "r1",
            seq: 1,
            type: "run.completed",
            message: "",
            data: {},
            created_at: "2026-01-01T00:00:00Z",
          };
        },
        get: async () => ({ answer: "ok" }),
      },
    }),
  };
});

const { runAsk } = await import("../commands/ask.js");

function mkConfig(model: string | null): ResolvedConfig {
  return {
    baseUrl: "http://localhost:8000",
    token: null,
    tenantId: "demo-tenant",
    userId: "demo-user",
    model,
    profileName: "test",
    theme: null,
    debug: false,
    orgSlug: null,
    harnessBaseUrl: "http://localhost:8000",
  };
}

async function ask(model: string | null): Promise<string> {
  const stdout = new PassThrough();
  let out = "";
  stdout.on("data", (c: Buffer) => (out += c.toString()));
  const code = await runAsk({
    message: "hi",
    config: mkConfig(model),
    stdout,
    stderr: new PassThrough(),
    noColor: true,
  });
  expect(code).toBe(0);
  return out;
}

describe("runAsk — model", () => {
  beforeEach(() => create.mockClear());

  it("omits model and mode when no model is configured", async () => {
    const out = await ask(null);
    const req = (create.mock.calls[0] as unknown[])[0];
    expect(req).not.toHaveProperty("model");
    expect(req).not.toHaveProperty("mode");
    expect(out).toContain("default model / demo-tenant");
  });

  it("sends the configured model", async () => {
    const out = await ask("model-b");
    expect((create.mock.calls[0] as unknown[])[0]).toMatchObject({
      model: "model-b",
    });
    expect(out).toContain("model-b / demo-tenant");
  });
});
