import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import es from "@/lang/es.json";
import type { I18nDictionary } from "@/features/i18n/i18n.service.types";
import { HarnessChatI18nProvider } from "../context/harness-chat-i18n-context";
import { formatDuration } from "../run-activity";
import type { RunActivity } from "../run-activity-types";
import { RunActivityRow } from "./run-activity";

const activity: RunActivity = {
  runId: "run_render",
  status: "completed",
  stepCount: 3,
  durationMs: 42_000,
  usage: {
    inputTokens: 181_200,
    cachedInputTokens: 150_000,
    outputTokens: 80,
    models: ["m-large"],
  },
  steps: [
    {
      id: "c1",
      tool: "acs_query",
      label: "Consultando la base de datos",
      args: { sql: "select count(*)\nfrom trips", limit: 10 },
      argsTruncated: false,
      preview: { rows: [{ count: 7 }] },
      previewTruncated: true,
      ms: 1850,
      ok: true,
      error: null,
      startedAt: "2026-01-01T00:00:01Z",
    },
    {
      id: "d1",
      tool: "delegate",
      label: "Delegando una tarea a un subagente",
      args: { brief: "count late" },
      argsTruncated: false,
      preview: null,
      previewTruncated: false,
      ms: 3000,
      ok: true,
      error: null,
      startedAt: "2026-01-01T00:00:02Z",
      steps: [
        {
          id: "k1",
          tool: "acs_describe",
          label: "Leyendo la estructura de una tabla",
          args: { table: "trips" },
          argsTruncated: false,
          preview: null,
          previewTruncated: false,
          ms: 400,
          ok: false,
          error: "no such table",
          startedAt: "2026-01-01T00:00:03Z",
        },
      ],
    },
  ],
};

function renderRow(runId: string) {
  return render(
    <HarnessChatI18nProvider dict={es as unknown as I18nDictionary}>
      <RunActivityRow runId={runId} />
    </HarnessChatI18nProvider>
  );
}

describe("RunActivityRow", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads the activity on first open and shows each step", async () => {
    const fetchMock = vi.fn<(url: string) => Promise<Response>>(
      async () => new Response(JSON.stringify(activity))
    );
    vi.stubGlobal("fetch", fetchMock);

    renderRow("run_render");
    fireEvent.click(screen.getByRole("button", { name: /Actividad/ }));

    expect(await screen.findByText("3 pasos · 42 s")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/api/harness/chat/runs/run_render"
    );
    expect(screen.getByText("Consultando la base de datos")).toBeTruthy();
    expect(screen.getByText("1.9 s")).toBeTruthy();
    // The delegation's own step is listed under it.
    expect(screen.getByText("Leyendo la estructura de una tabla")).toBeTruthy();
    expect(
      screen.getByText(/181[.,]200 tokens de entrada \(150[.,]000 en caché\)/)
    ).toBeTruthy();

    fireEvent.click(screen.getByText("Consultando la base de datos"));
    expect(screen.getByText("Argumentos")).toBeTruthy();
    expect(screen.getByText(/from trips/)).toBeTruthy();
    expect(screen.getByText("Resultado (recortado)")).toBeTruthy();
    expect(screen.getByText(/"count": 7/)).toBeTruthy();

    fireEvent.click(screen.getByText("Leyendo la estructura de una tabla"));
    expect(screen.getByText("no such table")).toBeTruthy();

    // Closing and reopening reuses the loaded activity.
    const summary = screen.getByRole("button", { name: /3 pasos/ });
    fireEvent.click(summary);
    fireEvent.click(summary);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says so when the activity cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 502 }))
    );
    renderRow("run_missing");
    fireEvent.click(screen.getByRole("button", { name: /Actividad/ }));
    expect(
      await screen.findByText("No se pudo cargar la actividad.")
    ).toBeTruthy();
  });
});

describe("formatDuration", () => {
  it("never shows 60 seconds in the minute form", () => {
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(4_240)).toBe("4.2 s");
    expect(formatDuration(119_600)).toBe("2 min 0 s");
    expect(formatDuration(125_000)).toBe("2 min 5 s");
  });
});
