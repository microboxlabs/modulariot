import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type {
  HarnessEvent,
  MiotHarnessClient,
  ModelsInfo,
} from "@microboxlabs/miot-harness-client";
import type { ResolvedConfig } from "../config.js";
import { runRepl } from "../repl/loop.js";

function mkConfig(model: string | null = null): ResolvedConfig {
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

function evt(type: HarnessEvent["type"], data: Record<string, unknown> = {}): HarnessEvent {
  return {
    id: `e_${type}`,
    run_id: "r1",
    seq: 1,
    type,
    message: "",
    data,
    created_at: "2026-01-01T00:00:00Z",
  };
}

function mkClient(models: ModelsInfo) {
  const create = vi.fn(async () => ({ run_id: "r1" }));
  const list = vi.fn(async () => models);
  const client = {
    models: { list },
    runs: {
      create,
      stream: async function* (): AsyncGenerator<HarnessEvent> {
        yield evt("answer.completed", { text: "done" });
        yield evt("run.completed");
      },
      get: vi.fn(async () => {
        throw new Error("not needed");
      }),
    },
  } as unknown as MiotHarnessClient;
  return { client, create, list };
}

async function drive(
  lines: string[],
  client: MiotHarnessClient,
  config: ResolvedConfig,
): Promise<{ out: string; err: string }> {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = "";
  let err = "";
  stdout.on("data", (c: Buffer) => (out += c.toString()));
  stderr.on("data", (c: Buffer) => (err += c.toString()));
  stdin.end(lines.map((l) => `${l}\n`).join(""));
  await runRepl({
    config,
    client,
    stdin,
    stdout,
    stderr,
    noColor: true,
    greet: false,
    configDir: mkdtempSync(join(tmpdir(), "miot-chat-loop-")),
  });
  return { out, err };
}

const MODELS: ModelsInfo = { default: "model-a", models: ["model-a", "model-b"] };

describe("runRepl — model", () => {
  it("sends no model and no mode when none is configured", async () => {
    const { client, create } = mkClient(MODELS);
    await drive(["hello"], client, mkConfig());
    const req = (create.mock.calls[0] as unknown[])[0];
    expect(req).toMatchObject({ message: "hello", tenant_id: "demo-tenant" });
    expect(req).not.toHaveProperty("model");
    expect(req).not.toHaveProperty("mode");
  });

  it("sends the configured model", async () => {
    const { client, create } = mkClient(MODELS);
    await drive(["hello"], client, mkConfig("model-a"));
    expect((create.mock.calls[0] as unknown[])[0]).toMatchObject({
      model: "model-a",
    });
  });

  it("/model lists the harness models", async () => {
    const { client, list } = mkClient(MODELS);
    const { out } = await drive(["/model"], client, mkConfig());
    expect(list).toHaveBeenCalledTimes(1);
    expect(out).toContain("model-a (default)");
    expect(out).toContain("model-b");
  });

  it("/model <name> applies to the next run; /model default clears it", async () => {
    const { client, create } = mkClient(MODELS);
    await drive(
      ["/model model-b", "first", "/model default", "second"],
      client,
      mkConfig(),
    );
    expect((create.mock.calls[0] as unknown[])[0]).toMatchObject({
      model: "model-b",
    });
    expect((create.mock.calls[1] as unknown[])[0]).not.toHaveProperty("model");
  });

  it("/model rejects a name the harness does not list", async () => {
    const { client, create } = mkClient(MODELS);
    const { err } = await drive(["/model nope", "hi"], client, mkConfig());
    expect(err).toContain("unknown model: nope");
    expect((create.mock.calls[0] as unknown[])[0]).not.toHaveProperty("model");
  });
});
