import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LevelSteps from "./level-steps";
import type { Step } from "./maintainer-api";

/** The condition editor reads its texts from here; the tests do not look at them. */
const AUDIENCE = { d: {}, fieldDict: {} };
import { scriptParts, fillScriptText } from "./script-fill";

const CTX = {
  case: { symptom: "Pérdida de señal", level: 4 },
  vehicle: { plate: "TEST-PLATE" },
  trip: { origin: "SCL", destination: "ANF", driver: { name: "Juan" } },
};

const mocked = vi.hoisted(() => ({
  contacts: { data: [] as unknown[] },
  samples: { data: [] as unknown[] },
  none: { data: undefined },
  results: {
    data: [{ value: "result_commits", label: { es: "Se compromete" } }],
  },
}));

vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (orig) => ({
    ...(await orig<object>()),
    useContacts: () => mocked.contacts,
    useScriptSamples: (name: string | null | undefined) =>
      name ? mocked.samples : mocked.none,
  })
);

vi.mock(
  "@/features/settings-admin/selectables/selectables-api",
  async (orig) => ({
    ...(await orig<object>()),
    useSelectableOptions: () => mocked.results,
  })
);

mocked.samples.data = [
  {
    symptom_id: -680,
    asset_id: "TEST-PLATE",
    icu_code: 4,
    opened_at: "2026-11-03T18:52:00Z",
    context: CTX,
  },
];

describe("scriptParts", () => {
  it("leaves unknown inherited property names unchanged", () => {
    const text =
      "{{constructor}} {{toString}} {{__proto__}} {{trip.constructor.name}}";
    expect(fillScriptText(text, CTX)).toBe(text);
    expect(
      scriptParts(text, CTX)
        .filter((p) => "variable" in p)
        .every((p) => "known" in p && !p.known)
    ).toBe(true);
  });

  it("fills fields and older names from the case and marks what it lacks", () => {
    expect(
      scriptParts(
        "Hola {{conductor}}, el {{ patente }} va por {{ruta}} a {{velocidad}}.",
        CTX
      )
    ).toEqual([
      { text: "Hola " },
      { variable: "conductor", value: "Juan", known: true },
      { text: ", el " },
      { variable: "patente", value: "TEST-PLATE", known: true },
      { text: " va por " },
      { variable: "ruta", value: "SCL → ANF", known: true },
      { text: " a " },
      { variable: "velocidad", value: null, known: false },
      { text: "." },
    ]);
    expect(scriptParts("{{trip.driver.name}}", CTX)).toEqual([
      { variable: "trip.driver.name", value: "Juan", known: true },
    ]);
    expect(scriptParts("{{trip.carrier.name}}", undefined)).toEqual([
      { variable: "trip.carrier.name", value: null, known: true },
    ]);
    expect(scriptParts("sin variables", CTX)).toEqual([
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
  stepThen: "min, sigue el siguiente",
  stepWithin: "plazo",
  stepChannel: "Canal",
  stepRole: "Persona",
  stepScope: "{label} · de",
  stepScopeRole: "{label} · rol",
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
  scriptGoalLabel: "Objetivo de la llamada",
  scriptAddReply: "Agregar respuesta",
  scriptReplySays: "Qué dice",
  scriptReplyResult: "Resultado",
};

const STEPS: Step[] = [
  {
    role: "Conductor",
    channel: "call",
    budgetMinutes: 2,
    script: "Hola, el camión {{patente}} va por {{ruta}}",
  },
  { role: "Jefe de turno", channel: "whatsapp", budgetMinutes: 3, script: "" },
];

describe("LevelSteps", () => {
  it("reads as an unnumbered timeline with the wait before the next step", () => {
    render(
      <LevelSteps
        audience={AUDIENCE}
        steps={STEPS}
        slaMinutes={5}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    const items = screen.getAllByRole("listitem");
    // Steps carry no visible number; the order is the list's, named for screen readers.
    expect(items[0]?.getAttribute("aria-label")).toBe("Paso 1");
    expect(items[0]?.textContent).not.toContain("Paso 1");
    expect(items[0]?.textContent).toContain("si no resulta en");
    expect(items[0]?.textContent).toContain("min, sigue el siguiente");
    expect(items[1]?.textContent).toContain("plazo");
    expect(within(items[1]!).getByText("escribir guion")).toBeTruthy();
  });

  it("opens the script in the side panel with a recent case's data, and edits its three parts", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        audience={AUDIENCE}
        steps={STEPS}
        slaMinutes={5}
        cases={{ symptomName: "Pérdida de señal", icu: 4 }}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText(/^Hola, el camión/));
    const panel = screen.getByRole("dialog", { name: "Guion · paso 1" });
    // In the preview and as the variables panel's example.
    expect(within(panel).getAllByText("TEST-PLATE").length).toBeGreaterThan(0);
    expect(within(panel).getByText("SCL → ANF")).toBeTruthy();

    fireEvent.change(within(panel).getByLabelText("Guion"), {
      target: { value: "Nuevo" },
    });
    expect(onChange.mock.calls[0]?.[0][0].script).toBe("Nuevo");
    fireEvent.change(within(panel).getByLabelText("Objetivo de la llamada"), {
      target: { value: "Que confirme" },
    });
    expect(onChange.mock.calls[1]?.[0][0].goal).toBe("Que confirme");
    fireEvent.click(within(panel).getByText("Agregar respuesta"));
    expect(onChange.mock.calls[2]?.[0][0].replies).toEqual([
      { result: "", says: "" },
    ]);
  });

  it("inserts a case field at the caret from the variables panel", () => {
    const onChange = vi.fn();
    render(
      <LevelSteps
        audience={AUDIENCE}
        steps={[{ ...STEPS[0]!, script: "va por  hoy" }]}
        slaMinutes={5}
        cases={{ symptomName: "Pérdida de señal", icu: 4 }}
        readOnly={false}
        d={d}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText("va por hoy"));
    const panel = screen.getByRole("dialog", { name: "Guion · paso 1" });
    const box = within(panel).getByLabelText("Guion") as HTMLTextAreaElement;
    box.focus();
    box.setSelectionRange(7, 7);
    const item = within(panel).getAllByText("{{vehicle.plate}}").at(-1)!;
    expect(fireEvent.mouseDown(item)).toBe(false);
    fireEvent.click(item);
    expect(onChange.mock.calls[0]?.[0][0].script).toBe(
      "va por {{vehicle.plate}} hoy"
    );
  });

  it("keeps a moved step's own fields", () => {
    let steps = STEPS;
    const onChange = vi.fn((next: Step[]) => {
      steps = next;
    });
    const view = render(
      <LevelSteps
        audience={AUDIENCE}
        steps={steps}
        slaMinutes={5}
        readOnly={false}
        d={{ ...d, dragStep: "Mover" }}
        onChange={onChange}
      />
    );
    const second = screen.getByDisplayValue("3");
    // The drag handle also moves a step with the arrow keys.
    fireEvent.keyDown(screen.getAllByLabelText("Mover")[1]!, {
      key: "ArrowUp",
    });
    view.rerender(
      <LevelSteps
        audience={AUDIENCE}
        steps={steps}
        slaMinutes={5}
        readOnly={false}
        d={{ ...d, dragStep: "Mover" }}
        onChange={onChange}
      />
    );
    expect(steps.map((s) => s.role)).toEqual(["Jefe de turno", "Conductor"]);
    expect(screen.getByDisplayValue("3")).toBe(second);
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
    const view = render(
      <LevelSteps steps={steps} audience={AUDIENCE} {...props} />
    );
    const second = screen.getByDisplayValue("3");
    fireEvent.click(screen.getAllByLabelText("Quitar")[0]!);
    view.rerender(<LevelSteps steps={steps} audience={AUDIENCE} {...props} />);
    expect(steps.map((s) => s.role)).toEqual(["Jefe de turno"]);
    expect(screen.getByDisplayValue("3")).toBe(second);
  });

  it("shows a step's error under that step only", () => {
    render(
      <LevelSteps
        audience={AUDIENCE}
        steps={[{ ...STEPS[0]!, role: "" }, STEPS[1]!]}
        slaMinutes={5}
        errors={{ 0: { contact: "El paso 1 no dice a quién contactar." } }}
        readOnly={false}
        d={d}
        onChange={vi.fn()}
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(
      within(items[0]!).getByText("El paso 1 no dice a quién contactar.")
    ).toBeTruthy();
    expect(
      within(items[1]!).queryByText("El paso 1 no dice a quién contactar.")
    ).toBeNull();
  });

  it("lets readers read the script but not change the steps", () => {
    render(
      <LevelSteps
        audience={AUDIENCE}
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
