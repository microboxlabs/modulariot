import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RunSummary } from "@microboxlabs/miot-harness-client";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../context/harness-chat-i18n-context";
import { ActivityButton, ActivityList } from "./activity-panel";

function run(overrides: Partial<RunSummary>): RunSummary {
  return {
    run_id: "r",
    conversation_id: "t1",
    tenant_id: "acme",
    user_id: "ana@example.com",
    status: "running",
    started_at: "2026-01-01T00:00:00Z",
    finished_at: null,
    model: null,
    skill_id: null,
    last_step: null,
    usage: { calls: 0, input_tokens: 0, output_tokens: 0 },
    delegates: [],
    ...overrides,
  };
}

const titles: Record<string, string> = {
  t1: "Viajes de enero",
  t2: "Choferes",
};

function renderList(runs: RunSummary[], onOpen = vi.fn()) {
  render(
    <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
      <ActivityList
        runs={runs}
        failed={false}
        titleOf={(id) => (id ? (titles[id] ?? null) : null)}
        onOpen={onOpen}
      />
    </HarnessChatI18nProvider>
  );
  return onOpen;
}

describe("ActivityList", () => {
  it("shows running runs with their step, then finished ones with status and duration", () => {
    renderList([
      run({
        run_id: "a",
        last_step: { label: "Starting db_query", tool: "trips_query" },
        delegates: [{ brief: "contar viajes", status: "running" }],
      }),
      run({
        run_id: "b",
        conversation_id: "t2",
        status: "completed",
        finished_at: "2026-01-01T00:01:05Z",
      }),
      run({
        run_id: "c",
        conversation_id: "zz",
        status: "failed",
        finished_at: "2026-01-01T00:00:03Z",
      }),
    ]);

    const running = screen.getByRole("heading", {
      name: "En curso",
    }).parentElement!;
    expect(within(running).getByText("Viajes de enero")).toBeTruthy();
    const step = within(running).getByText(es.harnessChat.stream.steps.query);
    expect(step.className).toContain("animate-harness-shimmer");
    expect(within(running).getByText("contar viajes")).toBeTruthy();

    const recent = screen.getByRole("heading", {
      name: "Recientes",
    }).parentElement!;
    expect(within(recent).getByText("Choferes")).toBeTruthy();
    expect(within(recent).getByText("01:05")).toBeTruthy();
    expect(within(recent).getByText("Listo")).toBeTruthy();
    expect(within(recent).getByText("Chat sin título")).toBeTruthy();
    expect(within(recent).getByText("Falló")).toBeTruthy();
  });

  it("shows a run waiting for an approval instead of its step", () => {
    renderList([
      run({
        last_step: { label: "Starting load_skill", tool: "load_skill" },
        pending_approval: { approval_id: "a1", tool: "mcp_call" },
      }),
    ]);
    expect(screen.getByText("Esperando tu aprobación")).toBeTruthy();
    expect(screen.queryByText("Cargando instrucciones")).toBeNull();
  });

  it("opens the run's thread on click", () => {
    const onOpen = renderList([
      run({ run_id: "b", conversation_id: "t2", status: "completed" }),
    ]);
    fireEvent.click(screen.getByText("Choferes"));
    expect(onOpen).toHaveBeenCalledWith("t2");
  });

  it("says so when there is nothing to show", () => {
    renderList([]);
    expect(screen.getByText("No hay ejecuciones recientes.")).toBeTruthy();
  });
});

describe("ActivityButton", () => {
  it("shows the running count and toggles the panel", () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
        <ActivityButton
          open={false}
          onOpenChange={onOpenChange}
          runningCount={2}
          className=""
        >
          <p>contenido</p>
        </ActivityButton>
      </HarnessChatI18nProvider>
    );
    const button = screen.getByRole("button", { name: "Actividad" });
    expect(within(button).getByText("2")).toBeTruthy();
    expect(screen.queryByText("contenido")).toBeNull();
    fireEvent.click(button);
    expect(onOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
        <ActivityButton
          open
          onOpenChange={onOpenChange}
          runningCount={0}
          className=""
        >
          <p>contenido</p>
        </ActivityButton>
      </HarnessChatI18nProvider>
    );
    expect(screen.getByRole("dialog", { name: "Actividad" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});
