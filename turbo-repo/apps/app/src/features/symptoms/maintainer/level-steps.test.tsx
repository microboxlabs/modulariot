import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LevelSteps from "./level-steps";
import type { Step } from "./maintainer-api";
import { scriptParts } from "./script-fill";

const SAMPLE = {
  signal: {
    vehicle: { plate: "AB1234" },
    trip: { route: "SCL - ANF" },
    gps: { speed_kmh: 112 },
    road: { maxspeed_osm: 90 },
  },
};

describe("scriptParts", () => {
  it("fills the variables the sample has and marks the ones it lacks", () => {
    expect(
      scriptParts(
        "Hola {{conductor}}, el {{ patente }} va a {{velocidad}}.",
        SAMPLE
      )
    ).toEqual([
      { text: "Hola " },
      { variable: "conductor", value: null, known: true },
      { text: ", el " },
      { variable: "patente", value: "AB1234", known: true },
      { text: " va a " },
      { variable: "velocidad", value: null, known: false },
      { text: "." },
    ]);
    expect(scriptParts("{{ruta}}", undefined)).toEqual([
      { variable: "ruta", value: null, known: true },
    ]);
    expect(scriptParts("{{constructor}}", SAMPLE)).toEqual([
      { variable: "constructor", value: null, known: false },
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
  scriptNoSample: "Sin muestras",
  scriptNoSampleValue: "sin muestra",
  scriptUnknown: "no se llena",
  scriptEmpty: "Sin guion.",
  close: "Cerrar",
  stepCall: "Llamar",
};

const STEPS: Step[] = [
  {
    role: "Conductor",
    channel: "call",
    budgetMinutes: 2,
    script: "Hola, el camión {{patente}} va por {{ruta}}",
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
    expect(screen.getByText("SCL - ANF")).toBeTruthy();
    expect(screen.getByText("Vista")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Guion"), {
      target: { value: "Nuevo" },
    });
    expect(onChange.mock.calls[0]?.[0][0].script).toBe("Nuevo");
  });

  it("inserts a variable at the caret without taking focus from the script", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        steps={[{ ...STEPS[0]!, script: "va por  hoy" }]}
        slaMinutes={5}
        sample={SAMPLE}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("va por hoy"));
    const box = screen.getByLabelText("Guion") as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(7, 7);
    const chip = screen.getByText("{{ruta}}");
    expect(fireEvent.mouseDown(chip)).toBe(false);
    fireEvent.click(chip);
    expect(onChange.mock.calls[0]?.[0][0].script).toBe("va por {{ruta}} hoy");
  });

  it("keeps a moved step's own fields", () => {
    let steps = STEPS;
    const onChange = vi.fn((next: Step[]) => {
      steps = next;
    });
    const view = render(
      <LevelSteps
        steps={steps}
        slaMinutes={5}
        readOnly={false}
        d={{ ...d, moveUp: "Subir" }}
        onChange={onChange}
      />
    );
    const second = screen.getByDisplayValue("Transportista");
    fireEvent.click(screen.getAllByLabelText("Subir")[1]!);
    view.rerender(
      <LevelSteps
        steps={steps}
        slaMinutes={5}
        readOnly={false}
        d={{ ...d, moveUp: "Subir" }}
        onChange={onChange}
      />
    );
    expect(steps.map((s) => s.role)).toEqual(["Transportista", "Conductor"]);
    expect(screen.getByDisplayValue("Transportista")).toBe(second);
  });

  it("keeps the next step's own fields when the first is removed", () => {
    let steps = STEPS;
    const onChange = vi.fn((next: Step[]) => {
      steps = next;
    });
    const props = {
      slaMinutes: 5,
      readOnly: false,
      d: { ...d, removeStep: "Quitar" },
      onChange,
    };
    const view = render(<LevelSteps steps={steps} {...props} />);
    const second = screen.getByDisplayValue("Transportista");
    fireEvent.click(screen.getAllByLabelText("Quitar")[0]!);
    view.rerender(<LevelSteps steps={steps} {...props} />);
    expect(steps.map((s) => s.role)).toEqual(["Transportista"]);
    expect(screen.getByDisplayValue("Transportista")).toBe(second);
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
    expect(screen.getByText("Sin muestras")).toBeTruthy();
    expect(screen.getAllByText("{{patente}}").length).toBeGreaterThan(0);
  });
});
