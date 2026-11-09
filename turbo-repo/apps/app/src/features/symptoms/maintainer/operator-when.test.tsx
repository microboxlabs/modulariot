import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Finding, LevelResponse, SymptomSpec } from "./maintainer-api";
import { overviewText } from "./overview-text";

vi.mock("./cel-editor", () => ({
  default: ({
    value,
    ariaLabel,
    placeholder,
    readOnly,
    onChange,
  }: {
    value: string;
    ariaLabel: string;
    placeholder?: string;
    readOnly?: boolean;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label={ariaLabel}
      placeholder={placeholder}
      readOnly={readOnly}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  insertIntoFocused: vi.fn(),
}));
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) =>
    createElement("img", props),
}));
vi.mock("@/features/conversations/conversations-api", () => ({
  useConversationRules: () => ({ data: [] }),
  useEventCatalog: () => ({ data: undefined }),
}));
vi.mock("next/navigation", () => ({ useParams: () => ({ lang: "es" }) }));

import ResponseWorkspace from "./response-workspace";

const AUDIENCE = { d: {}, fieldDict: {} };
const NOT_OTR_OTE = 'signal.trip.type != "otr" && signal.trip.type != "ote"';

const d = {
  levelName1: "Bajo observación",
  levelName2: "Comprometida",
  levelName3: "Crítica",
  levelName4: "Código negro",
  levelNotApplies: "No aplica",
  noOperator: "Sin operador",
  operatorSla: "Operador · SLA {minutes} min",
  requiresOperator: "Requiere operador",
  operatorWhenLabel: "Solo cuando…",
  operatorWhenPlaceholder: "Siempre",
  operatorWhenHint: "Vacía: siempre.",
  operatorConditional: "con condición",
  attendWithin: "Atender en",
};

const response = (patch: Partial<LevelResponse> = {}): LevelResponse => ({
  operator: true,
  slaMinutes: 15,
  steps: [],
  notices: [],
  evidence: [],
  ignorable: true,
  ...patch,
});

const spec = (four: LevelResponse): SymptomSpec =>
  ({
    levels: [
      { icu: 1, applies: false, when: null, response: null },
      { icu: 2, applies: false, when: null, response: null },
      { icu: 3, applies: false, when: null, response: null },
      { icu: 4, applies: true, when: "true", response: four },
    ],
  }) as SymptomSpec;

const renderIt = (
  four: LevelResponse,
  { findings = [] as Finding[], readOnly = false } = {}
) => {
  const onChange = vi.fn();
  render(
    <ResponseWorkspace
      audience={AUDIENCE}
      spec={spec(four)}
      changedLevels={new Set()}
      findings={findings}
      readOnly={readOnly}
      icu={4}
      sourceFields={[{ path: "signal.trip.type", type: "text" }]}
      d={d}
      onIcu={vi.fn()}
      onChange={onChange}
    />
  );
  const fourOf = (call = 0) =>
    (onChange.mock.calls[call]?.[0] as SymptomSpec).levels?.find(
      (l) => l.icu === 4
    )?.response;
  return { onChange, fourOf };
};

describe("Solo cuando… under Requiere operador", () => {
  it("is offered only while the level requires an operator", () => {
    renderIt(response({ operator: false, slaMinutes: null }));
    expect(screen.queryByLabelText("Solo cuando…")).toBeNull();
  });

  it("saves the condition, and an empty one as none", () => {
    const { fourOf } = renderIt(response());
    const field = screen.getByLabelText("Solo cuando…") as HTMLTextAreaElement;
    expect(field.value).toBe("");
    expect(field.placeholder).toBe("Siempre");

    fireEvent.change(field, { target: { value: NOT_OTR_OTE } });
    expect(fourOf(0)?.operatorWhen).toBe(NOT_OTR_OTE);
    expect(fourOf(0)?.slaMinutes).toBe(15);
  });

  it("clears to none when emptied", () => {
    const { fourOf } = renderIt(response({ operatorWhen: NOT_OTR_OTE }));
    fireEvent.change(screen.getByLabelText("Solo cuando…"), {
      target: { value: "  " },
    });
    expect(fourOf(0)?.operatorWhen).toBeNull();
  });

  it("drops the condition with the operator", () => {
    const { fourOf } = renderIt(response({ operatorWhen: NOT_OTR_OTE }));
    fireEvent.click(screen.getByRole("switch"));
    expect(fourOf(0)?.operator).toBe(false);
    expect(fourOf(0)?.operatorWhen).toBeNull();
  });

  it("shows its findings beside it and counts them on the level", () => {
    renderIt(response({ operatorWhen: "signal.trip.kind" }), {
      findings: [
        {
          section: "levels.4.response.operatorWhen",
          severity: "ERROR",
          message: "No existe el campo signal.trip.kind.",
          position: 12,
        },
      ],
    });
    expect(
      screen.getByText("No existe el campo signal.trip.kind.")
    ).toBeTruthy();
    const level = screen.getByRole("button", { name: /Código negro/ });
    expect(within(level).getByText("1")).toBeTruthy();
  });

  it("is shown read-only and named in the level's summary", () => {
    renderIt(response({ operatorWhen: NOT_OTR_OTE }), { readOnly: true });
    const field = screen.getByLabelText("Solo cuando…") as HTMLTextAreaElement;
    expect(field.value).toBe(NOT_OTR_OTE);
    expect(field.readOnly).toBe(true);
    expect(
      screen.getByText("Operador · SLA 15 min · con condición")
    ).toBeTruthy();
  });

  it("is part of the text the overview describes", () => {
    const text = overviewText({
      ...spec(response({ operatorWhen: NOT_OTR_OTE })),
      activation: "signal.trip.active",
    });
    expect(text).toContain(`nivel 4: true · operador 15 min si ${NOT_OTR_OTE}`);
  });
});
