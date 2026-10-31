import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Preview, SamplePreview, SymptomSpec } from "./maintainer-api";

vi.mock("./cel-editor", () => ({
  default: ({
    value,
    ariaLabel,
    onChange,
  }: {
    value: string;
    ariaLabel: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
  insertIntoFocused: vi.fn(),
}));

import LevelsExpression, { levelsVerdict } from "./levels-expression";

const d = {
  measureCelLabel: "Medida · CEL",
  noMeasure: "Sin medida",
  levelName1: "Bajo observación",
  levelName2: "Comprometida",
  levelName3: "Crítica",
  levelName4: "Código negro",
  sampleOf: "Muestra {n} de {total}",
  previousSample: "Anterior",
  nextSample: "Siguiente",
  insertField: "Insertar {path}",
  verdictCaseMeasure: "Abre un caso · medida {measure} → {level}",
  verdictNoCase: "No abre un caso.",
};

const level = (icu: number, applies: boolean, when: string) => ({
  icu,
  applies,
  when,
  response: null,
});

const SPEC = {
  source: "gps_signal",
  activation: "true",
  measure: {
    expression: "signal.frame.gps.speed - 90",
    label: null,
    unit: null,
  },
  levels: [
    level(1, true, "measure > 0 && measure < 5"),
    level(2, false, ""),
    level(3, true, "measure >= 5"),
  ],
} as unknown as SymptomSpec;

const sample = (patch: Partial<SamplePreview>): SamplePreview => ({
  sample: { signal: { frame: { gps: { speed: 112 } } } },
  activates: true,
  measure: 22,
  level: 3,
  error: null,
  clauses: [],
  ...patch,
});

const PREVIEW: Preview = {
  source: "gps_signal",
  samples: [sample({}), sample({ activates: false, level: null })],
};

const renderIt = (
  preview: Preview | undefined,
  { index = 0, onChange = vi.fn(), onIndex = vi.fn() } = {}
) =>
  render(
    <LevelsExpression
      spec={SPEC}
      preview={preview}
      index={index}
      fields={[]}
      sourceFields={[]}
      findings={[]}
      readOnly={false}
      d={d}
      onIndex={onIndex}
      onChange={onChange}
    />
  );

describe("LevelsExpression", () => {
  it("shows the measure and what the sample does, without the level thresholds", () => {
    renderIt(PREVIEW);
    expect(
      (screen.getByLabelText("Medida · CEL") as HTMLTextAreaElement).value
    ).toBe("signal.frame.gps.speed - 90");
    expect(screen.queryByLabelText(/Umbral por nivel/)).toBeNull();
    expect(screen.getByText("Abre un caso · medida 22 → Crítica")).toBeTruthy();
  });

  it("shows the sample it is given and asks for the next one", () => {
    const onIndex = vi.fn();
    renderIt(PREVIEW, { index: 1, onIndex });
    expect(screen.getByText("No abre un caso.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Anterior"));
    expect(onIndex).toHaveBeenCalledWith(0);
  });

  it("writes the new measure into the spec", () => {
    const onChange = vi.fn();
    renderIt(PREVIEW, { onChange });
    fireEvent.change(screen.getByLabelText("Medida · CEL"), {
      target: { value: "signal.frame.gps.speed - 100" },
    });
    const next = onChange.mock.calls[0]?.[0] as SymptomSpec;
    expect(next.measure?.expression).toBe("signal.frame.gps.speed - 100");
    expect(next.levels).toEqual(SPEC.levels);
  });

  it("says nothing about the sample while the preview is being made", () => {
    renderIt(undefined);
    expect(screen.queryByText(/Abre un caso/)).toBeNull();
  });
});

describe("levelsVerdict", () => {
  it("names the conditions of section 1 that kept the case closed", () => {
    const closed = sample({
      activates: false,
      level: null,
      clauses: [
        { text: "a == TRUE", holds: false, values: {}, error: null },
        { text: "b > 1", holds: true, values: {}, error: null },
      ],
    });
    expect(
      levelsVerdict(closed, {
        ...d,
        verdictNoCaseBecause: "No abre: {conditions}",
      })
    ).toBe("No abre: a == TRUE");
    expect(levelsVerdict(sample({ activates: false }), d)).toBe(
      "No abre un caso."
    );
  });
});
