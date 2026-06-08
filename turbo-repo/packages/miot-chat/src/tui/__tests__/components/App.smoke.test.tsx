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
    debug: false,
    orgSlug: null,
    harnessBaseUrl: "http://localhost:8000",
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
  it(
    "submits a prompt, streams events, and shows the final answer",
    { timeout: 15000 },
    async () => {
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
  },
  );

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

  it(
    "renders the final record.answer when answer.completed has no data.text (data_meta case)",
    { timeout: 15000 },
    async () => {
      // Reproduces the user-reported flow: harness emits
      // answer.completed with empty data + a 'Meta agent answered'
      // status message, then run.completed. runs.get returns the
      // full record with the real answer. The assistant turn should
      // end up at status="complete" showing record.answer.
      const ctx = deterministicCtx();
      const events: HarnessEvent[] = [
        evt("run.started"),
        evt("route.selected", { data: { route: "data_meta" } }),
        evt("answer.completed", {
          message: "Meta agent answered",
          data: { length: 42 },
        }),
        evt("run.completed"),
      ];
      const record: HarnessRunRecord = {
        run_id: "r-nexo",
        status: "completed",
        events,
        artifacts: [],
        answer: "REAL_ANSWER_FROM_GET",
        conversation_id: "c1",
      };
      const client = {
        runs: {
          create: vi.fn(async () => ({ run_id: "r-nexo" })),
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
        <App
          config={mkConfig()}
          client={client}
          home="/tmp/miot-app-nexo"
          {...ctx}
        />,
      );
      await new Promise((r) => setTimeout(r, 50));
      stdin.write("Cuales son las funciones del esquema nexo?");
      await new Promise((r) => setTimeout(r, 50));
      stdin.write("\r");
      await waitForFrame(lastFrame, "REAL_ANSWER_FROM_GET");
      // The status-marker should NOT appear as the assistant body.
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("Meta agent answered");
    },
  );

  it(
    "matches the live harness flow with a tool round-trip (alertas-hoy case)",
    { timeout: 15000 },
    async () => {
      // Matches the screenshot the user reported:
      //   route.selected data_query
      //   plan.created
      //   tool.started "Starting coordinador_eta_riesgo_hoy"
      //   tool.completed "Completed coordinador_eta_riesgo_hoy"
      //   answer.completed { message: "...", data: { length: N } } (no text)
      //   run.completed
      // runs.get returns the real markdown answer.
      const ctx = deterministicCtx();
      const events: HarnessEvent[] = [
        evt("run.started"),
        evt("route.selected", { data: { route: "data_query" } }),
        evt("plan.created", { message: "Initial plan created by filter_expert" }),
        evt("tool.started", {
          data: { name: "Starting coordinador_eta_riesgo_hoy" },
        }),
        evt("tool.completed", {
          message: "Completed coordinador_eta_riesgo_hoy",
          data: { name: "Completed coordinador_eta_riesgo_hoy" },
        }),
        evt("answer.completed", {
          message: "Synthesized final answer",
          data: { length: 1234 },
        }),
        evt("run.completed"),
      ];
      const ANSWER = "ALERTS_PARA_HOY_REAL_BODY";
      const record: HarnessRunRecord = {
        run_id: "r-alertas",
        status: "completed",
        events,
        artifacts: [],
        answer: ANSWER,
        conversation_id: "c1",
      };
      const client = {
        runs: {
          create: vi.fn(async () => ({ run_id: "r-alertas" })),
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
        <App
          config={mkConfig()}
          client={client}
          home="/tmp/miot-app-alertas"
          {...ctx}
        />,
      );
      await new Promise((r) => setTimeout(r, 50));
      stdin.write("cuales son las alertas para hoy?");
      await new Promise((r) => setTimeout(r, 50));
      stdin.write("\r");
      await waitForFrame(lastFrame, ANSWER);
      const frame = lastFrame() ?? "";
      // The single collapsed tool row, no duplicate.
      expect(frame).toContain("coordinador_eta_riesgo_hoy");
      // Should not be stuck on the "Synthesized final answer" marker.
      expect(frame).not.toContain("Synthesized final answer");
    },
  );

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
