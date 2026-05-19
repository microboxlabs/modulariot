import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import { App } from "../../App.js";
import type { ResolvedConfig } from "../../../config.js";
import type {
  HarnessEvent,
  HarnessEventType,
  HarnessRunRecord,
} from "@microboxlabs/miot-harness-client";

function evt(
  type: HarnessEventType,
  overrides: Partial<HarnessEvent> = {},
): HarnessEvent {
  return {
    id: overrides.id ?? `e_${type}`,
    run_id: overrides.run_id ?? "r-test",
    seq: overrides.seq ?? 1,
    type,
    message: overrides.message ?? "",
    data: overrides.data ?? {},
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
  };
}

function mkConfig(): ResolvedConfig {
  return {
    baseUrl: "http://localhost:8000",
    token: null,
    tenantId: "demo-tenant",
    userId: "demo-user",
    mode: "auto",
    profileName: "test",
    theme: null,
  };
}

function deterministicCtx(): { now: () => string; uuid: () => string } {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

async function waitForFrame(
  lastFrame: () => string | undefined,
  match: string,
  attempts = 80,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    if ((lastFrame() ?? "").includes(match)) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error(
    `frame never contained ${JSON.stringify(match)}; last frame was:\n${lastFrame() ?? "(undef)"}`,
  );
}

describe("<App /> smoke", () => {
  it("submits a prompt, streams events, and shows the final answer", async () => {
    const ctx = deterministicCtx();
    const events: HarnessEvent[] = [
      evt("run.started"),
      evt("tool.started", { data: { name: "stock_lookup" } }),
      evt("tool.completed", { data: { name: "stock_lookup" } }),
      evt("answer.completed", { data: { text: "12 SKUs in stock" } }),
      evt("run.completed"),
    ];
    const record: HarnessRunRecord = {
      run_id: "r-test",
      status: "completed",
      events,
      artifacts: [],
      answer: "12 SKUs in stock",
      conversation_id: "id-1",
    };

    const client = {
      runs: {
        create: vi.fn(async () => ({ run_id: "r-test" })),
        stream: async function* (): AsyncGenerator<HarnessEvent> {
          for (const e of events) {
            yield e;
            await new Promise((r) => setTimeout(r, 5));
          }
        },
        get: vi.fn(async () => record),
      },
    };

    const { stdin, lastFrame } = render(
      <App config={mkConfig()} client={client} home="/tmp/miot-app-smoke" {...ctx} />,
    );

    // Wait for the editor to be ready; then type and submit.
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("what's in stock?");
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("\r");

    await waitForFrame(lastFrame, "stock_lookup");
    await waitForFrame(lastFrame, "12 SKUs in stock");
    expect(client.runs.create).toHaveBeenCalledTimes(1);
  });

  it("dispatches /whoami as a slash command (appends a system item)", async () => {
    const ctx = deterministicCtx();
    const client = {
      runs: {
        create: vi.fn(),
        stream: vi.fn(),
        get: vi.fn(),
      },
    };
    const { stdin, lastFrame } = render(
      <App config={mkConfig()} client={client} home="/tmp/miot-app-slash" {...ctx} />,
    );
    await new Promise((r) => setTimeout(r, 50));
    stdin.write("/whoami\r");
    await waitForFrame(lastFrame, "user=demo-user");
    // /whoami should NOT have triggered a harness call.
    expect(client.runs.create).not.toHaveBeenCalled();
  });

  it("renders the header with tenant/user/conv chips", async () => {
    const ctx = deterministicCtx();
    const client = {
      runs: {
        create: vi.fn(),
        stream: vi.fn(),
        get: vi.fn(),
      },
    };
    const { lastFrame } = render(
      <App config={mkConfig()} client={client} home="/tmp/miot-app-header" {...ctx} />,
    );
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("tenant=demo-tenant");
    expect(frame).toContain("user=demo-user");
  });
});
