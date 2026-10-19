import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CasePreview, Preview } from "./maintainer-api";

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

import LifecycleExpression, { caseOutcome } from "./lifecycle-expression";

const d = {
  opensCelLabel: "Se abre cuando · CEL",
  closesCelLabel: "Se cierra cuando · CEL",
  caseScenario_held: "Sin abrir · 75 s",
  caseScenario_ongoing: "En curso · 75 s",
  caseOutcome_opens: "Se abre un caso.",
  caseOutcome_stays_open: "Este caso está abierto y sigue abierto.",
  sampleOf: "Muestra {n} de {total}",
  previousSample: "Anterior",
  nextSample: "Siguiente",
  insertField: "Insertar {path}",
};

const moment = (patch: Partial<CasePreview>): CasePreview => ({
  scenario: "held",
  open: false,
  sample: { caso: { condicion_s: 75 } },
  outcome: "opens",
  error: null,
  ...patch,
});

const PREVIEW: Preview = {
  source: "gps_signal",
  samples: [],
  cases: [
    moment({}),
    moment({ scenario: "ongoing", open: true, outcome: "stays_open" }),
  ],
};

const LIFECYCLE = {
  open: "caso.condicion_s >= 60",
  close: "caso.normal_s >= 120",
  levelDown: false,
};

describe("caseOutcome", () => {
  it("names the outcome, or gives the error", () => {
    expect(caseOutcome(moment({}), d)).toBe("Se abre un caso.");
    expect(
      caseOutcome(moment({ outcome: null, error: "no es sí o no" }), d)
    ).toBe("no es sí o no");
  });
});

describe("LifecycleExpression", () => {
  it("shows each case moment by name with what the rules do on it", () => {
    render(
      <LifecycleExpression
        lifecycle={LIFECYCLE}
        preview={PREVIEW}
        fields={[]}
        openProblems={[]}
        closeProblems={[]}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText("Sin abrir · 75 s")).toBeTruthy();
    expect(screen.getByText("Se abre un caso.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Siguiente"));
    expect(screen.getByText("En curso · 75 s")).toBeTruthy();
    expect(
      screen.getByText("Este caso está abierto y sigue abierto.")
    ).toBeTruthy();
  });

  it("edits the open and close rules", () => {
    const onChange = vi.fn();
    render(
      <LifecycleExpression
        lifecycle={LIFECYCLE}
        preview={undefined}
        fields={[]}
        openProblems={[]}
        closeProblems={[]}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText("Se cierra cuando · CEL"), {
      target: { value: "caso.cerrado_por_operador" },
    });
    expect(onChange).toHaveBeenCalledWith({
      ...LIFECYCLE,
      close: "caso.cerrado_por_operador",
    });
    expect(screen.queryByText(/Se abre un caso/)).toBeNull();
  });
});
