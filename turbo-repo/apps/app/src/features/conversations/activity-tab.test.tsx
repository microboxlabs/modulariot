import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationRun, RuleSummary } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationRules: vi.fn(),
  useConversationRuns: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import ActivityTab, { activityFilterDefs, RunsTable } from "./activity-tab";

const d = es.pages.userSettings.communications;

const RUN: ConversationRun = {
  id: "run1",
  ruleId: "r1",
  ruleName: "Botón de pánico",
  ruleVersion: "0.1.0",
  eventId: "e1",
  eventType: "symptom.case.opened",
  contextKind: "symptom_case",
  contextKey: "42",
  symptomName: null,
  assetId: null,
  test: true,
  status: "WAITING",
  step: 1,
  nextAt: "2026-10-23T12:05:00Z",
  lastError: null,
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: null,
  messages: [
    {
      id: "m1",
      step: 0,
      channel: "whatsapp",
      to: "+56900000000",
      toName: "Juan Soto",
      status: "SIMULATED",
      text: "Hola Juan Soto, ¿estás bien?",
      at: "2026-10-23T12:00:00Z",
    },
  ],
};

describe("RunsTable", () => {
  it("shows a row per run and opens it to its messages", () => {
    render(<RunsTable runs={[RUN]} lang="es" d={d} />);
    const row = screen
      .getByText("Botón de pánico")
      .closest("tr") as HTMLElement;
    expect(within(row).getByText("Condición 42")).toBeTruthy();
    expect(within(row).getByText("Esperando")).toBeTruthy();
    expect(within(row).getByText("Sigue el paso 2")).toBeTruthy();
    expect(within(row).getByText("Prueba")).toBeTruthy();
    expect(screen.queryByText("Hola Juan Soto, ¿estás bien?")).toBeNull();

    const toggle = within(row).getByRole("button", {
      name: "Mensajes de Botón de pánico",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Hola Juan Soto, ¿estás bien?")).toBeTruthy();
    expect(screen.getByText("Juan Soto")).toBeTruthy();
    expect(screen.getByText("+56900000000")).toBeTruthy();
    expect(screen.getByText("Simulado")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "WhatsApp" }).getAttribute("data-channel")
    ).toBe("whatsapp");

    fireEvent.click(toggle);
    expect(screen.queryByText("Hola Juan Soto, ¿estás bien?")).toBeNull();
  });

  it("names the symptom case by its symptom and asset", () => {
    const runs: ConversationRun[] = [
      {
        ...RUN,
        id: "a",
        symptomName: "Exceso de velocidad",
        assetId: "ABCD12",
      },
      { ...RUN, id: "b", ruleName: "Solo patente", assetId: "WXYZ98" },
    ];
    render(<RunsTable runs={runs} lang="es" d={d} />);
    expect(screen.getByText("Exceso de velocidad · ABCD12")).toBeTruthy();
    expect(screen.getByText("WXYZ98")).toBeTruthy();
    expect(screen.queryByText("Condición 42")).toBeNull();
  });
});

describe("ActivityTab", () => {
  it("filters the runs by the rule and status the filter bar names", () => {
    api.useConversationRules.mockReturnValue({
      data: [{ id: "r1", name: "Botón de pánico" }],
    });
    api.useConversationRuns.mockReturnValue({ data: [] });
    const { rerender } = render(
      <ActivityTab lang="es" filters={{ rule: "", status: "" }} d={d} />
    );
    expect(screen.getByText("Aún no hay ejecuciones.")).toBeTruthy();
    expect(api.useConversationRuns).toHaveBeenLastCalledWith({
      rule: null,
      status: null,
    });
    rerender(
      <ActivityTab
        lang="es"
        filters={{ rule: "Botón de pánico", status: "Falló" }}
        d={d}
      />
    );
    expect(api.useConversationRuns).toHaveBeenLastCalledWith({
      rule: "r1",
      status: "FAILED",
    });
    expect(screen.getByText("Ninguna ejecución coincide.")).toBeTruthy();
  });

  it("tells apart two rules with the same name by their key", () => {
    const rules = [
      { id: "r1", key: "panic-a", name: "Pánico" },
      { id: "r2", key: "panic-b", name: "Pánico" },
    ] as RuleSummary[];
    expect(activityFilterDefs(rules, d)[0].options).toEqual([
      "Pánico (panic-a)",
      "Pánico (panic-b)",
    ]);
    api.useConversationRules.mockReturnValue({ data: rules });
    api.useConversationRuns.mockReturnValue({ data: [] });
    render(
      <ActivityTab
        lang="es"
        filters={{ rule: "Pánico (panic-b)", status: "" }}
        d={d}
      />
    );
    expect(api.useConversationRuns).toHaveBeenLastCalledWith({
      rule: "r2",
      status: null,
    });
  });

  it("offers each rule and run status as a filter option", () => {
    const defs = activityFilterDefs(
      [{ id: "r1", name: "Botón de pánico" } as RuleSummary],
      d
    );
    expect(defs.map((f) => f.label)).toEqual(["Regla", "Estado"]);
    expect(defs[0].options).toEqual(["Botón de pánico"]);
    expect(defs[1].options).toEqual([
      "Esperando",
      "Respondió",
      "Terminada",
      "Falló",
      "Cancelada",
    ]);
  });
});
