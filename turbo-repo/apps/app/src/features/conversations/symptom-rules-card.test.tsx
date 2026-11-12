import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleSummary } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConversationRules: vi.fn(),
  useEventCatalog: () => ({ data: undefined }),
}));
vi.mock("./conversations-api", () => api);
vi.mock("next/navigation", () => ({
  useParams: () => ({ lang: "es" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import SymptomRulesCard from "./symptom-rules-card";

const d = es.pages.userSettings.symptomCatalog;
const rulesDict = es.pages.userSettings.communications;

const rule = (patch: Partial<RuleSummary>): RuleSummary => ({
  id: "r1",
  key: "panic-driver",
  name: "Pánico: conductor",
  state: "TEST",
  currentVersion: "0.1.0",
  hasDraft: false,
  trigger: {
    event: "symptom.case.opened",
    when: "event.data.symptomKey == 'panic-button' && event.data.level >= 4",
  },
  stepsCount: 2,
  channels: ["whatsapp", "email"],
  ...patch,
});

const renderCard = (icu = 4, canWrite = true) =>
  render(
    <SymptomRulesCard
      symptomKey="panic-button"
      symptomName="Botón de pánico"
      icu={icu}
      canWrite={canWrite}
      d={d}
      rulesDict={rulesDict}
    />
  );

describe("SymptomRulesCard", () => {
  beforeEach(() => {
    api.useConversationRules.mockReset();
  });

  it("shows the rules that name the symptom at this level as the Comunicaciones page's cards", () => {
    api.useConversationRules.mockReturnValue({
      data: [
        rule({}),
        rule({
          id: "r2",
          name: "Otra",
          trigger: {
            event: "symptom.case.opened",
            when: "event.data.symptomKey == 'speeding'",
          },
        }),
        rule({
          id: "r3",
          name: "Por clave del servidor",
          symptomKey: "panic-button",
          state: "ACTIVE",
          stepsCount: 1,
          channels: ["email"],
          trigger: { event: "symptom.case.closed", when: null },
        }),
      ],
    });
    renderCard();
    const list = screen.getByRole("list", { name: "Comunicaciones" });
    expect(list.className).toContain("md:grid-cols-2");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);

    // RuleCard: the whole card is the link to the rule.
    const first = within(items[0]!).getByRole("link");
    expect(first.getAttribute("href")).toBe(
      "/es/users/settings/communications/rules/r1"
    );
    expect(first.textContent).toContain("Pánico: conductor");
    expect(first.textContent).toContain("v0.1.0");
    expect(first.textContent).toContain("Botón de pánico");
    const whatsapp = within(first).getByTitle("WhatsApp");
    expect(whatsapp.getAttribute("data-channel")).toBe("whatsapp");
    expect(within(whatsapp).getByText("WhatsApp").className).toBe("sr-only");
    const email = within(first).getByTitle("Correo");
    expect(email.getAttribute("data-channel")).toBe("email");
    expect(within(email).getByText("Correo").className).toBe("sr-only");
    expect(items[1]!.textContent).toContain("Por clave del servidor");
  });

  it("leaves out a rule whose level is above this one", () => {
    api.useConversationRules.mockReturnValue({ data: [rule({})] });
    renderCard(3);
    expect(screen.queryByRole("list")).toBeNull();
    expect(
      screen.getByText(/se configuran como reglas de comunicación/)
    ).toBeTruthy();
  });

  it("opens a new rule prefilled with the case opening, the symptom and the level", () => {
    api.useConversationRules.mockReturnValue({ data: [] });
    renderCard(3);
    const href = screen
      .getByRole("link", { name: "Nueva regla para este nivel" })
      .getAttribute("href") as string;
    const url = new URL(href, "http://x");
    expect(url.pathname).toBe("/es/users/settings/communications");
    expect(url.searchParams.get("new")).toBe("1");
    expect(url.searchParams.get("event")).toBe("symptom.case.opened");
    expect(url.searchParams.get("when")).toBe(
      "event.data.symptomKey == 'panic-button' && event.data.level >= 3"
    );
    expect(url.searchParams.get("name")).toBe("Botón de pánico · Crítica");
  });

  it("offers no new rule to someone who cannot edit", () => {
    api.useConversationRules.mockReturnValue({ data: [] });
    renderCard(4, false);
    expect(
      screen.queryByRole("link", { name: "Nueva regla para este nivel" })
    ).toBeNull();
  });
});
