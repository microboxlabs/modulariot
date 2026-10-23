import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationRun } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationRules: vi.fn(),
  useConversationRuns: vi.fn(),
}));
vi.mock("./conversations-api", () => api);

import ActivityTab, { RunsTable } from "./activity-tab";

const d = es.pages.userSettings.communications;

const RUN: ConversationRun = {
  id: "run1",
  ruleId: "r1",
  ruleName: "Botón de pánico",
  ruleVersion: 1,
  eventId: "e1",
  eventType: "symptom.case.opened",
  contextKind: "symptom_case",
  contextKey: "42",
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
    expect(within(row).getByText("Caso 42")).toBeTruthy();
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
});

describe("ActivityTab", () => {
  it("filters the runs by rule and status", () => {
    api.useConversationRules.mockReturnValue({
      data: [{ id: "r1", name: "Botón de pánico" }],
    });
    api.useConversationRuns.mockReturnValue({ data: [] });
    render(<ActivityTab lang="es" d={d} />);
    expect(screen.getByText("Aún no hay ejecuciones.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Regla"), {
      target: { value: "r1" },
    });
    fireEvent.change(screen.getByLabelText("Estado"), {
      target: { value: "FAILED" },
    });
    expect(api.useConversationRuns).toHaveBeenLastCalledWith({
      rule: "r1",
      status: "FAILED",
    });
  });
});
