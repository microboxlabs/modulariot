import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import type { RuleDetail, RuleSpec } from "./conversations-types";

const SPEC: RuleSpec = {
  trigger: {
    event: "symptom.case.opened",
    when: "event.data.symptomKey == 'panic-button' && event.data.level >= 4",
  },
  audience: [{ role: "driver" }],
  steps: [
    {
      after: 0,
      channel: "whatsapp",
      template: "panic-check",
      to: "audience",
      waitForReply: 5,
      onReply: "stop",
    },
  ],
};

const DETAIL: RuleDetail = {
  rule: {
    id: "r1",
    key: "panic-driver",
    name: "Pánico: conductor",
    state: "TEST",
    currentVersion: "0.1.0",
  },
  current: {
    id: "v1",
    version: "0.1.0",
    status: "PUBLISHED",
    spec: SPEC,
    reason: null,
    createdAt: "2026-10-23T12:00:00Z",
    createdBy: null,
  },
  draft: null,
  versions: [],
};

const api = vi.hoisted(() => ({
  useConversationRule: vi.fn(),
  useConversationTemplates: vi.fn(),
  useEventCatalog: vi.fn(),
  useRuleFamilies: vi.fn(() => ({ data: undefined, error: undefined })),
  saveRuleDraft: vi.fn(),
  publishRule: vi.fn(),
  setRuleState: vi.fn(),
  simulateRule: vi.fn(),
  refreshRules: vi.fn(),
  useConnectionChannel: vi.fn(() => ({ data: undefined })),
}));
vi.mock("./conversations-api", () => api);
vi.mock("@/features/symptoms/maintainer/maintainer-api", () => ({
  useControlTowerAccess: () => ({ canMaintain: true }),
}));
vi.mock("./use-symptom-names", () => ({
  useSymptomNames: () => (key: string) =>
    key === "panic-button" ? "Botón de pánico" : undefined,
}));

import RuleEditor from "./rule-editor";

const mutate = vi.fn();

describe("RuleEditor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    api.useConversationRule.mockReturnValue({ data: DETAIL, mutate });
    api.useConversationTemplates.mockReturnValue({
      data: [{ id: "t1", key: "panic-check", name: "Chequeo de pánico" }],
    });
    api.useEventCatalog.mockReturnValue({
      data: [
        {
          type: "symptom.case.opened",
          source: "miot-symptoms",
          description: "A symptom case opened",
          contextKind: "symptom_case",
          fields: [
            { name: "symptomKey", label: "Clave del síntoma", type: "string" },
          ],
          variables: [{ name: "patente", label: "Patente", type: "string" }],
        },
      ],
    });
    api.saveRuleDraft.mockResolvedValue({
      draft: { ...DETAIL.current, id: "d1", version: null, status: "DRAFT" },
      findings: [
        {
          section: "steps.1",
          severity: "ERROR",
          code: "stepNoTemplate",
          params: { n: "2" },
          message: "x",
          position: -1,
        },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("shows the rule's sections, summary and variables", () => {
    render(<RuleEditor id="r1" dict={es.pages.userSettings} lang="es" />);
    expect(
      screen.getByRole("heading", { name: "Pánico: conductor" })
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Cuando se abre una condición de Botón de pánico en Código negro"
      )
    ).toBeTruthy();
    for (const title of ["Cuándo se envía", "A quién", "Pasos", "Simulación"]) {
      expect(screen.getByRole("heading", { name: title })).toBeTruthy();
    }
    expect(screen.getByText("{{patente}}")).toBeTruthy();
    expect(screen.getByText("{{symptomKey}}")).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "Borrador sin publicar" })
    ).toBeNull();
  });

  it("saves an edit as the draft and shows the finding under its step", async () => {
    render(<RuleEditor id="r1" dict={es.pages.userSettings} lang="es" />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar paso" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(700);
    });
    expect(api.saveRuleDraft).toHaveBeenCalledTimes(1);
    expect(api.saveRuleDraft.mock.calls[0][1].steps).toHaveLength(2);
    const step2 = screen.getByRole("listitem", { name: "Paso 2" });
    expect(
      within(step2).getByText("El paso 2 no tiene plantilla.")
    ).toBeTruthy();
    expect(screen.getByText("1 error impide publicar")).toBeTruthy();
  });
});
