import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleSummary } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationRules: vi.fn(),
  useEventCatalog: vi.fn(),
}));
vi.mock("./conversations-api", () => api);
vi.mock("./use-symptom-names", () => ({ useSymptomNames: () => () => null }));

import RulesTab, { NO_RULE_FILTERS, ruleFilterDefs } from "./rules-tab";

const d = es.pages.userSettings.communications;

const PANIC: RuleSummary = {
  id: "r1",
  key: "panic",
  name: "Botón de pánico",
  state: "ACTIVE",
  currentVersion: "0.2.0",
  hasDraft: true,
  trigger: { event: "symptom.case.opened", when: null },
  stepsCount: 2,
  channels: ["whatsapp", "email"],
};

const CLOSED: RuleSummary = {
  id: "r2",
  key: "closed",
  name: "Cierre de caso",
  state: "OFF",
  currentVersion: null,
  hasDraft: false,
  trigger: { event: "symptom.case.closed", when: null },
  stepsCount: 1,
  channels: ["email"],
};

describe("RulesTab", () => {
  beforeEach(() => {
    api.useConversationRules.mockReturnValue({ data: [PANIC, CLOSED] });
    api.useEventCatalog.mockReturnValue({ data: [] });
  });

  it("offers the states, the rules' events and their channels as filters", () => {
    const defs = ruleFilterDefs([PANIC, CLOSED], [], d);
    expect(defs.map((f) => f.label)).toEqual(["Estado", "Evento", "Canal"]);
    expect(defs[0].options).toEqual(["Activa", "En prueba", "Apagada"]);
    expect(defs[1].options).toEqual([
      "Síntomas · Condición abierta",
      "Síntomas · Condición cerrada",
    ]);
    expect(defs[2].options).toEqual(["WhatsApp", "Correo"]);
  });

  it("shows only the rules that pass the filters", () => {
    render(
      <RulesTab
        lang="es"
        filters={{ ...NO_RULE_FILTERS, channel: "WhatsApp" }}
        layout="cards"
        d={d}
      />
    );
    expect(screen.getByText("Botón de pánico")).toBeTruthy();
    expect(screen.queryByText("Cierre de caso")).toBeNull();
  });

  it("says so when no rule passes", () => {
    render(
      <RulesTab
        lang="es"
        filters={{ ...NO_RULE_FILTERS, state: "En prueba" }}
        layout="cards"
        d={d}
      />
    );
    expect(screen.getByText("Ninguna regla coincide.")).toBeTruthy();
  });

  it("lists the rules as table rows that link to each rule", () => {
    render(
      <RulesTab lang="es" filters={NO_RULE_FILTERS} layout="list" d={d} />
    );
    const row = screen
      .getByRole("link", { name: "Botón de pánico" })
      .closest("tr") as HTMLElement;
    expect(
      screen.getByRole("link", { name: "Botón de pánico" }).getAttribute("href")
    ).toBe("/es/users/settings/communications/rules/r1");
    expect(within(row).getByText("2 pasos")).toBeTruthy();
    expect(within(row).getByText("Activa")).toBeTruthy();
    expect(within(row).getByText("borrador")).toBeTruthy();
    expect(within(row).getByText("v0.2.0")).toBeTruthy();
    expect(screen.getByText("Sin publicar")).toBeTruthy();
  });

  it("lays a card out like a symptom card: event under the name, tags, version at the foot", () => {
    render(
      <RulesTab lang="es" filters={NO_RULE_FILTERS} layout="cards" d={d} />
    );
    const card = screen
      .getByText("Botón de pánico")
      .closest("a") as HTMLElement;
    expect(card.getAttribute("href")).toBe(
      "/es/users/settings/communications/rules/r1"
    );
    expect(within(card).getByText("Síntomas · Condición abierta")).toBeTruthy();
    expect(within(card).getByText("Activa")).toBeTruthy();
    expect(within(card).getByText("2 pasos")).toBeTruthy();
    expect(within(card).getAllByText("WhatsApp").length).toBeGreaterThan(0);
    expect(within(card).getByText("v0.2.0")).toBeTruthy();
    expect(within(card).getByText("borrador")).toBeTruthy();
  });
});
