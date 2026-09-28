import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../../context/harness-chat-i18n-context";
import { HarnessSessionProvider } from "../../context/harness-session-context";
import {
  WorkAreaProvider,
  type WorkArea,
} from "../../context/work-area-context";
import type { KnowledgeChange } from "../knowledge-change-args";
import type { Evaluation } from "../learning-eval-args";
import { ShowKnowledgeChangeCard } from "./show-knowledge-change-card";
import { ShowLearningEvalCard } from "./show-learning-eval-card";

type ChangeProps = ComponentProps<typeof ShowKnowledgeChangeCard>;
type EvalProps = ComponentProps<typeof ShowLearningEvalCard>;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function wrap(node: ReactNode, workArea?: WorkArea) {
  const session = {
    threadId: "thread-1",
    runStartedAt: () => null,
    subscribeRunClock: () => () => {},
  };
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
        <HarnessSessionProvider session={session}>
          {workArea ? (
            <WorkAreaProvider value={workArea}>{node}</WorkAreaProvider>
          ) : (
            node
          )}
        </HarnessSessionProvider>
      </HarnessChatI18nProvider>
    </SWRConfig>
  );
}

const change: KnowledgeChange = {
  path: "facts/trips/states.md",
  layer: "fact",
  id: "states",
  target: "trips",
  op: "write",
  diff: "--- a/facts/trips/states.md\n+++ b/facts/trips/states.md\n@@ -0,0 +1,2 @@\n+ADDED: in the plan\n+SCHEDULED: running\n",
  title: null,
  content: null,
  reason: null,
  version: 1,
};

describe("ShowKnowledgeChangeCard", () => {
  it("renders what a trainer tool changed and records it for the session", () => {
    const workArea = { open: vi.fn(), recordChange: vi.fn() };
    const addResult = vi.fn();
    wrap(
      <ShowKnowledgeChangeCard
        {...({
          args: { tool: "ws_write", changes: [change] },
          addResult,
        } as unknown as ChangeProps)}
      />,
      workArea
    );
    expect(screen.getByText("Cambio de conocimiento")).toBeTruthy();
    expect(screen.getByText("states.md")).toBeTruthy();
    expect(screen.getByText("Hechos de datos")).toBeTruthy();
    expect(screen.getByText("v1")).toBeTruthy();
    expect(screen.getByText("+2")).toBeTruthy();
    expect(workArea.recordChange).toHaveBeenCalledWith("thread-1", change);
    expect(addResult).toHaveBeenCalledWith({});
    fireEvent.click(screen.getByLabelText("Abrir en el área de trabajo"));
    expect(workArea.open).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "file",
        layer: "fact",
        id: "states",
        target: "trips",
      })
    );
  });

  it("titles a scratchpad edit as such and keeps it out of the session's changes", () => {
    const workArea = { open: vi.fn(), recordChange: vi.fn() };
    wrap(
      <ShowKnowledgeChangeCard
        {...({
          args: {
            tool: "fs_edit",
            changes: [{ ...change, path: "notes.md", layer: null, id: null }],
          },
          result: {},
          addResult: vi.fn(),
        } as unknown as ChangeProps)}
      />,
      workArea
    );
    expect(screen.getByText("Archivo de trabajo")).toBeTruthy();
    expect(workArea.recordChange).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Abrir en el área de trabajo")).toBeNull();
  });

  it("says when the diff arrived shortened", () => {
    wrap(
      <ShowKnowledgeChangeCard
        {...({
          args: { tool: "ws_write", changes: [change], truncated: true },
          result: {},
          addResult: vi.fn(),
        } as unknown as ChangeProps)}
      />
    );
    expect(
      screen.getByText("El diff llegó acortado. Ábrelo para verlo completo.")
    ).toBeTruthy();
  });
});

const evaluation: Evaluation = {
  id: "ev1",
  status: "done",
  model: "model-a",
  progress: { done: 2, total: 2 },
  summary: {
    baseline_avg: 1.5,
    candidate_avg: 4,
    improved: 1,
    regressed: 1,
    unchanged: 0,
  },
  results: [
    {
      case: {
        question: "¿Cuántos viajes se cargaron hoy?",
        expectation: "Cuenta los viajes en seguimiento",
      },
      baseline: {
        answer: "No lo sé",
        score: 1,
        reason: "no answer",
        skills_used: [],
      },
      candidate: {
        answer: "Hoy se cargaron 12",
        score: 5,
        reason: "matches",
        skills_used: ["trips"],
        model: "model-a",
        trigger: { ok: true, missing: [], unexpected: [] },
      },
    },
    {
      case: {
        question: "¿Cuántos terminaron?",
        expectation: "Cuenta los históricos",
      },
      baseline: { answer: "3", score: 2, reason: "partial" },
      candidate: {
        answer: "",
        score: 0,
        reason: "wrong",
        error: "timed out after 120 s",
        trigger: { ok: false, missing: ["trips"], unexpected: [] },
      },
    },
  ],
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ShowLearningEvalCard", () => {
  it("shows the baseline and candidate averages and how the cases moved", async () => {
    fetchMock.mockResolvedValue(json(evaluation));
    wrap(
      <ShowLearningEvalCard
        {...({
          args: { evaluationId: "ev1" },
          result: {},
          addResult: vi.fn(),
        } as unknown as EvalProps)}
      />
    );
    expect(await screen.findByText("4.0")).toBeTruthy();
    expect(screen.getByText("1.5")).toBeTruthy();
    expect(screen.getByText("1 mejoraron")).toBeTruthy();
    expect(screen.getByText("1 empeoraron")).toBeTruthy();
    expect(screen.getByText(/model-a/)).toBeTruthy();
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/api/harness/learning/evaluations/ev1"
    );
  });

  it("expands into a table of cases with both answers when there is no working area", async () => {
    fetchMock.mockResolvedValue(json(evaluation));
    wrap(
      <ShowLearningEvalCard
        {...({
          args: { evaluationId: "ev1" },
          result: {},
          addResult: vi.fn(),
        } as unknown as EvalProps)}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: "Ver casos" }));
    expect(screen.getByText("¿Cuántos viajes se cargaron hoy?")).toBeTruthy();
    expect(screen.getByText("No lo sé")).toBeTruthy();
    expect(screen.getByText("Hoy se cargaron 12")).toBeTruthy();
    expect(screen.getByText("matches")).toBeTruthy();
    expect(screen.getByText(/Procedimientos usados: trips/)).toBeTruthy();
    expect(screen.getByText("Usó los procedimientos esperados")).toBeTruthy();
    expect(screen.getByText("timed out after 120 s")).toBeTruthy();
    expect(
      screen.getByText("Procedimientos: faltó trips; sobró –")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Empeoraron" }));
    expect(screen.queryByText("¿Cuántos viajes se cargaron hoy?")).toBeNull();
    expect(screen.getByText("¿Cuántos terminaron?")).toBeTruthy();
  });

  it("opens the cases in the working area when there is one", async () => {
    fetchMock.mockResolvedValue(json(evaluation));
    const workArea = { open: vi.fn(), recordChange: vi.fn() };
    const args = { evaluationId: "ev1" };
    wrap(
      <ShowLearningEvalCard
        {...({ args, result: {}, addResult: vi.fn() } as unknown as EvalProps)}
      />,
      workArea
    );
    fireEvent.click(screen.getByLabelText("Ver casos"));
    expect(workArea.open).toHaveBeenCalledWith({
      kind: "eval",
      evaluationId: "ev1",
      card: args,
    });
  });

  it("shows progress while the evaluation runs", async () => {
    fetchMock.mockResolvedValue(
      json({
        ...evaluation,
        status: "running",
        summary: null,
        progress: { done: 1, total: 4 },
        results: [],
      })
    );
    wrap(
      <ShowLearningEvalCard
        {...({
          args: { evaluationId: "ev1" },
          result: {},
          addResult: vi.fn(),
        } as unknown as EvalProps)}
      />
    );
    await waitFor(() =>
      expect(screen.getByText("Evaluando… 1/4")).toBeTruthy()
    );
  });

  it("keeps the summary it came with when the evaluation cannot be read", async () => {
    fetchMock.mockResolvedValue(json({}, 403));
    wrap(
      <ShowLearningEvalCard
        {...({
          args: {
            evaluationId: "ev1",
            summary: {
              baseline_avg: 2,
              candidate_avg: 3,
              improved: 2,
              regressed: 0,
              unchanged: 1,
            },
          },
          result: {},
          addResult: vi.fn(),
        } as unknown as EvalProps)}
      />
    );
    expect(screen.getByText("3.0")).toBeTruthy();
    expect(screen.getByText("2 mejoraron")).toBeTruthy();
  });
});
