import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { ConversationTemplate, RuleStep } from "./conversations-types";

const api = vi.hoisted(() => ({
  useConnectionChannel: vi.fn(),
  useLatestEvent: vi.fn(),
  useOrgMetaTemplates: vi.fn(() => ({ data: undefined })),
  useConversationTemplates: vi.fn(() => ({ data: undefined })),
}));
vi.mock("./conversations-api", () => api);

import RuleSteps from "./rule-steps";

const d = es.pages.userSettings.communications;

const TEMPLATE: ConversationTemplate = {
  id: "t1",
  key: "coordinador_arrival",
  name: "Coordinador · Confirmación de arribo",
  baseText: "Arribo {{identificadorServicio}}",
  whatsapp: null,
  email: null,
  teams: {
    title: "Arribo",
    facts: [{ title: "Servicio", value: "{{identificadorServicio}}" }],
  },
};

const STEP: RuleStep = {
  after: 0,
  channel: "teams",
  template: TEMPLATE.key,
  connection: "c1",
  to: [],
  waitForReply: 0,
  onReply: "stop",
};

const EVENT = "coordinador.arrival_confirmation";
const VARIABLES = [
  {
    name: "identificadorServicio",
    label: "Identificador de Servicio",
    type: "string",
  },
];

function renderSteps() {
  return render(
    <RuleSteps
      steps={[STEP]}
      groups={[]}
      templates={[TEMPLATE]}
      event={EVENT}
      variables={VARIABLES}
      readOnly={false}
      d={d}
      onChange={vi.fn()}
    />
  );
}

const card = () => screen.getByRole("figure", { name: d.previewTeamsLabel });

describe("RuleSteps, the preview of a Teams step", () => {
  beforeEach(() => {
    api.useConnectionChannel.mockReturnValue({
      data: {
        operation: "deliver",
        requestSchema: {},
        connections: [
          {
            id: "c1",
            name: "Teams coordinador · ArrivalConfirmation",
            host: "example.com",
            status: "ACTIVE",
            lastTestedAt: null,
            lastTestResult: null,
            destination:
              "Coordinador de Viajes › Notificaciones Confirmación Arribo",
          },
        ],
      },
    });
  });

  it("shows where the connection's messages land", () => {
    api.useLatestEvent.mockReturnValue({ data: null });
    renderSteps();
    expect(
      screen.getByText(
        "Coordinador de Viajes › Notificaciones Confirmación Arribo"
      )
    ).toBeTruthy();
  });

  it("draws the card with the event's example values, and the newest real event on request", () => {
    api.useLatestEvent.mockReturnValue({
      data: {
        type: EVENT,
        context: { kind: "service", key: "1717959" },
        data: { identificadorServicio: "1717959" },
        test: false,
        at: "2026-11-16T01:14:00Z",
      },
    });
    renderSteps();
    fireEvent.click(screen.getByRole("button", { name: d.showTemplate }));

    expect(api.useLatestEvent).toHaveBeenCalledWith(EVENT);
    expect(card().textContent).toContain("Identificador de Servicio");

    fireEvent.click(screen.getByRole("button", { name: d.previewWithLatest }));
    expect(card().textContent).toContain("1717959");
    expect(screen.getByText(/· 1717959$/)).toBeTruthy();
  });

  it("offers the newest event only once one has arrived", () => {
    api.useLatestEvent.mockReturnValue({ data: null });
    renderSteps();
    fireEvent.click(screen.getByRole("button", { name: d.showTemplate }));
    const latest = screen.getByRole("button", { name: d.previewWithLatest });
    expect((latest as HTMLButtonElement).disabled).toBe(true);
    expect(latest.getAttribute("title")).toBe(
      d.previewNoEventYet.replace("{event}", EVENT)
    );
  });
});
