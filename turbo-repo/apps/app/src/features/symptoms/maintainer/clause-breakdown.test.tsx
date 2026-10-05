import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ClauseBreakdown, { verdict } from "./clause-breakdown";
import type { Preview, SamplePreview } from "./maintainer-api";

const d = {
  clauseByClause: "Condición por condición",
  and: "y",
  sampleOf: "Muestra {n} de {total}",
  previousSample: "Anterior",
  nextSample: "Siguiente",
  noClauses: "sin desglose",
  clauseHolds: "se cumple",
  clauseFails: "no se cumple",
  clauseError: "no se pudo evaluar",
  verdictNoCase: "No abre un caso.",
  verdictNoLevel: "ningún nivel",
  verdictCaseLevel: "Abre un caso → {level}",
  verdictCaseMeasure: "Abre un caso · medida {measure} → {level}",
  levelName4: "Código negro",
};

const sample = (patch: Partial<SamplePreview>): SamplePreview => ({
  sample: {},
  activates: true,
  measure: 22,
  level: 4,
  error: null,
  clauses: [],
  ...patch,
});

describe("verdict", () => {
  it("says whether a case opens and at which level", () => {
    expect(verdict(sample({}), d)).toBe(
      "Abre un caso · medida 22 → Código negro"
    );
    expect(verdict(sample({ measure: null }), d)).toBe(
      "Abre un caso → Código negro"
    );
    expect(verdict(sample({ level: null }), d)).toBe(
      "Abre un caso · medida 22 → ningún nivel"
    );
    expect(verdict(sample({ activates: false }), d)).toBe("No abre un caso.");
    expect(verdict(sample({ error: "falla" }), d)).toBe("falla");
  });
});

describe("ClauseBreakdown", () => {
  const preview: Preview = {
    source: "gps_signal",
    samples: [
      sample({
        clauses: [
          {
            text: "signal.trip.active",
            holds: true,
            values: { "signal.trip.active": true },
            error: null,
          },
          {
            text: 'signal.vehicle.weight_category == "HEAVY"',
            holds: false,
            values: { "signal.vehicle.weight_category": "LIGHT" },
            error: null,
          },
        ],
        activates: false,
      }),
      sample({ clauses: [] }),
    ],
  };

  it("shows each condition with its result and values, sample by sample", () => {
    render(<ClauseBreakdown preview={preview} d={d} />);
    expect(screen.getByText("Muestra 1 de 2")).toBeTruthy();
    expect(screen.getByText("se cumple")).toBeTruthy();
    expect(screen.getByText("no se cumple")).toBeTruthy();
    expect(
      screen.getByText('signal.vehicle.weight_category = "LIGHT"')
    ).toBeTruthy();
    expect(screen.getByText("No abre un caso.")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Siguiente"));
    expect(screen.getByText("Muestra 2 de 2")).toBeTruthy();
    expect(screen.getByText("sin desglose")).toBeTruthy();
    expect(
      (screen.getByLabelText("Siguiente") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("joins the conditions with && and marks an opened case in green", () => {
    const opens: Preview = {
      source: "gps_signal",
      samples: [
        sample({
          activates: true,
          measure: 22,
          level: 4,
          clauses: [
            { text: "a", holds: true, values: {}, error: null },
            { text: "b", holds: true, values: {}, error: null },
          ],
        }),
      ],
    };
    const { container } = render(<ClauseBreakdown preview={opens} d={d} />);
    const items = [...container.querySelectorAll("li")];
    expect(items[0]?.firstElementChild?.textContent).toBe("");
    expect(items[1]?.firstElementChild?.textContent).toBe("&&");
    expect(items[1]?.querySelector(".sr-only")?.textContent).toBe("y");
    expect(items[0]?.textContent).not.toContain("y");
    expect(container.querySelector("p.text-green-700")).not.toBeNull();
    const { container: closed } = render(
      <ClauseBreakdown preview={preview} d={d} />
    );
    expect(closed.querySelector("p.text-green-700")).toBeNull();
  });

  it("follows the sample picked elsewhere and has no ‹ › of its own", () => {
    const { rerender } = render(
      <ClauseBreakdown preview={preview} index={1} d={d} />
    );
    expect(screen.getByText("sin desglose")).toBeTruthy();
    expect(screen.queryByLabelText("Siguiente")).toBeNull();
    expect(screen.queryByText(/Muestra/)).toBeNull();
    rerender(<ClauseBreakdown preview={preview} index={5} d={d} />);
    expect(screen.getByText("sin desglose")).toBeTruthy();
  });

  it("renders nothing without samples", () => {
    const { container } = render(
      <ClauseBreakdown preview={{ source: "x", samples: [] }} d={d} />
    );
    expect(container.innerHTML).toBe("");
  });
});
