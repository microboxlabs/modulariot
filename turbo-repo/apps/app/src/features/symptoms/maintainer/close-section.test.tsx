import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  CaseTimelinePreview,
  CloseRules,
  type LifecycleRules,
} from "./close-section";

const stable = vi.hoisted(() => ({ types: { data: [] as unknown[] } }));
vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (original) => ({
    ...(await original<object>()),
    useScriptSamples: () => ({
      data: [
        {
          symptom_id: -1,
          asset_id: "TEST-PLATE",
          opened_at: "2026-01-01T00:00:00Z",
        },
      ],
    }),
    useCaseTimeline: () => ({
      data: [
        { kind: "CLOSED", at: "2026-01-01T00:01:00Z", context: null },
        { kind: "CLOSED", at: "2026-01-01T00:02:00Z", context: { case: {} } },
      ],
    }),
  })
);
vi.mock("./maintainer-api", async (orig) => ({
  ...(await orig<object>()),
  useEventTypes: () => stable.types.data,
}));

const d = {
  allLevels: "todos los niveles",
  closeAutoTitle: "Se cierra solo",
  closeKindLabel: "Cómo se cierra",
  closeKind: {
    operator: "Un operador lo cierra",
    normal: "Vuelve a la normalidad por",
    age: "Pasan",
    tripEnded: "Termina el viaje",
    event: "Llega el evento GPS",
  },
  closeLevelLabel: "Nivel",
  levelAny: "en cualquier nivel",
  levelAtMost: "y el nivel es ≤ {level}",
  levelName1: "L1",
  levelName2: "L2",
  levelName3: "L3",
  addCloseRow: "Condición de cierre",
  removeCloseRow: "Quitar condición",
  noteTitle: "Se anota",
  noteKind: "Llega el evento GPS",
  addNoteRow: "Anotación",
  noteNone: "Sin anotaciones.",
  noteNoEvents: "Sin eventos",
  lifeCannotShow: "No se puede mostrar.",
  editAsExpression: "Editar como expresión",
  closesCelLabel: "Se cierra cuando · CEL",
  notesCelLabel: "Se anota cuando · CEL",
  dragCondition: "Mover",
  eventType: "Tipo de evento",
};

const FIELDS = [
  { path: "case.level", detail: "" },
  { path: "case.normal_s", detail: "" },
  { path: "signal.frame.events", detail: "" },
];

function rules(patch: Partial<LifecycleRules> = {}): LifecycleRules {
  return {
    close: "case.closed_by_operator || (case.level <= 3 && case.normal_s >= 0)",
    note: "",
    fields: FIELDS,
    closeProblems: [],
    noteProblems: [],
    onChange: vi.fn(),
    ...patch,
  };
}

describe("CloseRules", () => {
  it("shows the lost-signal close rule as two rows and writes a new row back as CEL", () => {
    const r = rules();
    render(
      <CloseRules
        rules={r}
        mode="form"
        readOnly={false}
        d={d}
        onExpr={vi.fn()}
      />
    );
    const rows = screen.getAllByTestId("close-row");
    expect(rows).toHaveLength(2);
    expect(
      (within(rows[1]!).getByLabelText("Nivel") as HTMLSelectElement).value
    ).toBe("3");

    fireEvent.click(screen.getByText("Condición de cierre"));
    expect(r.onChange).toHaveBeenCalledWith({
      close:
        "case.closed_by_operator || (case.normal_s >= 0 && case.level <= 3) || case.closed_by_operator",
      note: null,
    });
  });

  it("adds a GPS event note, since the source has events", () => {
    const r = rules();
    render(
      <CloseRules
        rules={r}
        mode="form"
        readOnly={false}
        d={d}
        onExpr={vi.fn()}
      />
    );
    expect(screen.getByText("Sin anotaciones.")).toBeTruthy();
    fireEvent.click(screen.getByText("Anotación"));
    expect(r.onChange).toHaveBeenCalledWith({
      close: r.close,
      note: 'signal.frame.events.exists(e, e.event_type == "")',
    });
  });

  it("sends a rule the rows cannot say to the { } mode", () => {
    const onExpr = vi.fn();
    render(
      <CloseRules
        rules={rules({ close: "case.level > 2" })}
        mode="form"
        readOnly={false}
        d={d}
        onExpr={onExpr}
      />
    );
    fireEvent.click(screen.getByText("Editar como expresión"));
    expect(onExpr).toHaveBeenCalled();
  });

  it("shows both rules as CEL in { } mode", () => {
    render(
      <CloseRules
        rules={rules()}
        mode="expr"
        readOnly={false}
        d={d}
        onExpr={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Se cierra cuando · CEL")).toBeTruthy();
    expect(screen.getByLabelText("Se anota cuando · CEL")).toBeTruthy();
  });
});

describe("CaseTimelinePreview", () => {
  it("attributes only closures with recorded rule context to the close rule", () => {
    render(
      <CaseTimelinePreview
        symptomName="Synthetic symptom"
        icu={4}
        d={{ timelineTitle: "Timeline", fromCloseRule: "Close rule" }}
      />
    );
    expect(screen.getAllByText("Close rule")).toHaveLength(1);
  });
});
