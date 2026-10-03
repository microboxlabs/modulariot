import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LevelSteps from "./level-steps";
import type { Step } from "./maintainer-api";
import { scriptParts } from "./script-fill";

const SAMPLE = {
  signal: {
    vehicle: { plate: "AB1234" },
    gps: { speed_kmh: 112 },
    road: { maxspeed_osm: 90 },
  },
};

describe("scriptParts", () => {
  it("fills the variables the sample has and marks the ones it lacks", () => {
    expect(
      scriptParts(
        "Hola {{conductor}}, el {{ patente }} va a {{velocidad}} en {{limite}}.",
        SAMPLE
      )
    ).toEqual([
      { text: "Hola " },
      { variable: "conductor", value: null },
      { text: ", el " },
      { variable: "patente", value: "AB1234" },
      { text: " va a " },
      { variable: "velocidad", value: "112" },
      { text: " en " },
      { variable: "limite", value: "90" },
      { text: "." },
    ]);
    expect(scriptParts("{{ruta}}", undefined)).toEqual([
      { variable: "ruta", value: null },
    ]);
    expect(scriptParts("sin variables", SAMPLE)).toEqual([
      { text: "sin variables" },
    ]);
  });
});

const d = {
  steps: "Pasos",
  stepN: "Paso {n}",
  stepTo: "a",
  stepScriptLabel: "Guion:",
  stepScriptWrite: "escribir guion",
  stepIfNot: "si no resulta en",
  stepThen: "min, paso {n}",
  stepWithin: "plazo",
  stepChannel: "Canal",
  stepRole: "Persona",
  stepBudget: "Minutos",
  stepScript: "Guion",
  stepScriptPlaceholder: "Qué decir {vars}",
  scriptTitle: "Guion · paso {n}",
  scriptVariables: "Variables:",
  scriptPreview: "Vista",
  scriptMissing: "falta",
  scriptEmpty: "Sin guion.",
  close: "Cerrar",
  stepCall: "Llamar",
};

const STEPS: Step[] = [
  {
    role: "Conductor",
    channel: "call",
    budgetMinutes: 2,
    script: "Hola, el camión {{patente}} va a {{velocidad}} km/h",
  },
  { role: "Transportista", channel: "whatsapp", budgetMinutes: 3, script: "" },
];

describe("LevelSteps", () => {
  it("reads as a timeline with the wait before the next step", () => {
    render(
      <LevelSteps
        steps={STEPS}
        slaMinutes={5}
        sample={SAMPLE}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Paso 1");
    expect(items[0]?.textContent).toContain("si no resulta en");
    expect(items[0]?.textContent).toContain("min, paso 2");
    expect(items[1]?.textContent).toContain("plazo");
    expect(within(items[1]!).getByText("escribir guion")).toBeTruthy();
  });

  it("opens the script with its variables filled from the sample, and edits it", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        steps={STEPS}
        slaMinutes={5}
        sample={SAMPLE}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText(/^Hola, el camión/));
    expect(screen.getByText("Guion · paso 1")).toBeTruthy();
    expect(screen.getByText("AB1234")).toBeTruthy();
    expect(screen.getByText("112")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Guion"), {
      target: { value: "Nuevo" },
    });
    expect(onChange.mock.calls[0]?.[0][0].script).toBe("Nuevo");
  });

  it("inserts a variable at the caret without taking focus from the script", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        steps={[{ ...STEPS[0]!, script: "va a  km/h" }]}
        slaMinutes={5}
        sample={SAMPLE}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("va a km/h"));
    const box = screen.getByLabelText("Guion") as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(5, 5);
    const chip = screen.getByText("{{velocidad}}");
    expect(fireEvent.mouseDown(chip)).toBe(false);
    fireEvent.click(chip);
    expect(onChange.mock.calls[0]?.[0][0].script).toBe(
      "va a {{velocidad}} km/h"
    );
  });

  it("lets readers read the script but not change the steps", () => {
    render(
      <LevelSteps
        steps={STEPS}
        slaMinutes={5}
        readOnly
        d={d}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/Agregar|addStep/)).toBeNull();
    fireEvent.click(screen.getByText(/^Hola, el camión/));
    expect(
      (screen.getByLabelText("Guion") as HTMLTextAreaElement).disabled
    ).toBe(true);
    expect(screen.queryByText("Variables:")).toBeNull();
    expect(screen.getAllByText("{{patente}}").length).toBeGreaterThan(0);
  });
});
