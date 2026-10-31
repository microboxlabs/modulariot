import { fireEvent, render, screen } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Finding, LevelResponse, SymptomSpec } from "./maintainer-api";
import ResponseWorkspace, { firstResponseLevel } from "./response-workspace";

vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement("img", props),
}));

const conversations = vi.hoisted(() => ({ useConversationRules: vi.fn() }));
vi.mock("@/features/conversations/conversations-api", () => conversations);
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));

const d = {
  levelName1: "Bajo observación",
  levelName2: "Comprometida",
  levelName3: "Crítica",
  levelName4: "Código negro",
  levelNotApplies: "No aplica",
  levelNotAppliesHint: "Este nivel no aplica.",
  noOperator: "Sin operador",
  operatorSla: "Operador · SLA {minutes} min",
  stepsCount: "{n} pasos",
  stepsCountOne: "1 paso",
  copyResponseFrom: "Copiar de",
  copyResponsePick: "elegir nivel",
  attendWithin: "Atender en",
};

const response = (patch: Partial<LevelResponse> = {}): LevelResponse => ({
  operator: false,
  slaMinutes: null,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: true,
  ...patch,
});

const SPEC = {
  levels: [
    { icu: 1, applies: false, when: null, response: null },
    { icu: 2, applies: false, when: null, response: null },
    {
      icu: 3,
      applies: true,
      when: "true",
      response: response({
        notices: [
          {
            when: "open",
            channel: "whatsapp",
            connectionId: null,
            templateId: null,
            recipient: "Torre",
          },
        ],
      }),
    },
    {
      icu: 4,
      applies: true,
      when: "true",
      response: response({
        operator: true,
        slaMinutes: 5,
        steps: [{ role: "", channel: "call", budgetMinutes: 1, script: "" }],
      }),
    },
  ],
} as SymptomSpec;

const STEP_ERROR: Finding = {
  section: "levels.4.response",
  severity: "ERROR",
  code: "stepNoContact",
  params: { n: "1" },
  message: "El paso 1 no dice a quién contactar.",
  position: -1,
};

const renderIt = (
  icu: number,
  onChange = vi.fn(),
  onIcu = vi.fn(),
  spec = SPEC
) => {
  render(
    <ResponseWorkspace
      spec={spec}
      changedLevels={new Set()}
      findings={[STEP_ERROR]}
      readOnly={false}
      icu={icu}
      d={d}
      onIcu={onIcu}
      onChange={onChange}
    />
  );
  return { onChange, onIcu };
};

describe("ResponseWorkspace", () => {
  it("starts on a level with an error, else the highest that applies", () => {
    expect(firstResponseLevel(SPEC, [STEP_ERROR])).toBe(4);
    expect(firstResponseLevel(SPEC, [])).toBe(4);
    expect(
      firstResponseLevel(SPEC, [
        { ...STEP_ERROR, section: "levels.3.response" },
      ])
    ).toBe(3);
  });

  it("lists the levels with their summary and errors, and selects one", () => {
    const { onIcu } = renderIt(4);
    expect(screen.getAllByText("No aplica")).toHaveLength(2);
    expect(screen.getByText("Sin operador")).toBeTruthy();
    expect(screen.getByText("Operador · SLA 5 min · 1 paso")).toBeTruthy();
    expect(
      screen.getByText("El paso 1 no dice a quién contactar.")
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Crítica/ }));
    expect(onIcu).toHaveBeenCalledWith(3);
  });

  it("copies another level's response into this one", () => {
    const { onChange } = renderIt(4);
    fireEvent.change(screen.getByLabelText("Copiar de"), {
      target: { value: "3" },
    });
    const next = onChange.mock.calls[0]?.[0] as SymptomSpec;
    const four = next.levels?.find((l) => l.icu === 4);
    expect(four?.response?.operator).toBe(false);
    expect(four?.response?.notices[0]?.recipient).toBe("Torre");
    expect(four?.response).not.toBe(SPEC.levels?.[2]?.response);
  });

  it("still shows a step's error once the operator is turned off", () => {
    const off = {
      levels: SPEC.levels?.map((l) =>
        l.icu === 4 && l.response
          ? { ...l, response: { ...l.response, operator: false } }
          : l
      ),
    } as SymptomSpec;
    renderIt(4, vi.fn(), vi.fn(), off);
    expect(
      screen.getByText("El paso 1 no dice a quién contactar.")
    ).toBeTruthy();
  });

  it("explains a level that does not apply", () => {
    renderIt(1);
    expect(screen.getByText("Este nivel no aplica.")).toBeTruthy();
    expect(screen.queryByLabelText("Copiar de")).toBeNull();
  });

  it("lists the level's conversation rules for a symptom, none for a template", () => {
    conversations.useConversationRules.mockReturnValue({
      data: [
        {
          id: "r1",
          key: "panic-driver",
          name: "Pánico: conductor",
          state: "ACTIVE",
          currentVersion: 1,
          hasDraft: false,
          trigger: {
            event: "symptom.case.opened",
            when: "event.data.symptomKey == 'panic-button' && event.data.level >= 4",
          },
          stepsCount: 2,
          channels: ["whatsapp"],
        },
      ],
    });
    const { unmount } = render(
      <ResponseWorkspace
        spec={SPEC}
        symptom={{ key: "panic-button", name: "Botón de pánico" }}
        changedLevels={new Set()}
        findings={[]}
        readOnly={false}
        icu={4}
        d={d}
        onIcu={vi.fn()}
        onChange={vi.fn()}
      />
    );
    expect(
      screen
        .getByRole("link", { name: "Pánico: conductor" })
        .getAttribute("href")
    ).toBe("/es/users/settings/communications/rules/r1");
    unmount();

    renderIt(4);
    expect(
      screen.queryByRole("link", { name: "Pánico: conductor" })
    ).toBeNull();
  });
});
