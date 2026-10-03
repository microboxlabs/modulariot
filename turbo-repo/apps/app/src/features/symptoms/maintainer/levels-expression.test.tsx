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

vi.mock("./ui/level-icon", () => ({ LevelIcon: () => <span /> }));

import LevelsExpression from "./levels-expression";

const d = {
  measureCelLabel: "Medida · CEL",
  levelsCelLabel: "Umbral por nivel · CEL",
  levelReached: "alcanzado",
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
  measure: { expression: "signal.gps.speed_kmh - 90", label: null, unit: null },
  levels: [
    level(1, true, "medida > 0 && medida < 5"),
    level(2, false, ""),
    level(3, true, "medida >= 5"),
  ],
} as unknown as SymptomSpec;

const sample = (patch: Partial<SamplePreview>): SamplePreview => ({
  sample: { signal: { gps: { speed_kmh: 112 } } },
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

const renderIt = (preview: Preview | undefined, onChange = vi.fn()) =>
  render(
    <LevelsExpression
      spec={SPEC}
      preview={preview}
      sourceFields={[]}
      levelFields={[]}
      findings={[]}
      readOnly={false}
      d={d}
      onChange={onChange}
    />
  );

describe("LevelsExpression", () => {
  it("shows the measure and the levels that apply, with ✓ on the level the sample reaches", () => {
    renderIt(PREVIEW);
    expect(
      (screen.getByLabelText("Medida · CEL") as HTMLTextAreaElement).value
    ).toBe("signal.gps.speed_kmh - 90");
    expect(
      screen.queryByLabelText("Umbral por nivel · CEL · Comprometida")
    ).toBeNull();
    const reached = screen.getByText("alcanzado").parentElement;
    expect(reached?.textContent).toBe("✓alcanzado");
    expect(screen.getAllByText("✓")).toHaveLength(1);
    expect(screen.getByText("Abre un caso · medida 22 → Crítica")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Siguiente"));
    expect(screen.queryByText("✓")).toBeNull();
    expect(screen.getByText("No abre un caso.")).toBeTruthy();
  });

  it("writes a level's new rule into that level", () => {
    const onChange = vi.fn();
    renderIt(PREVIEW, onChange);
    fireEvent.change(
      screen.getByLabelText("Umbral por nivel · CEL · Crítica"),
      { target: { value: "medida >= 6" } }
    );
    const next = onChange.mock.calls[0]?.[0] as SymptomSpec;
    expect(next.levels?.find((l) => l.icu === 3)?.when).toBe("medida >= 6");
    expect(next.levels?.map((l) => l.icu)).toEqual([1, 2, 3]);
  });

  it("marks nothing while the preview of the spec on screen is being made", () => {
    renderIt(undefined);
    expect(screen.queryByText("✓")).toBeNull();
    expect(screen.queryByText(/Abre un caso/)).toBeNull();
  });
});
