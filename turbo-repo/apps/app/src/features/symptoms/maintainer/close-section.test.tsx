import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import es from "@/lang/es.json";
import {
  CaseTimelinePreview,
  CloseRules,
  type LifecycleRules,
} from "./close-section";

const stable = vi.hoisted(() => ({
  types: { data: [] as unknown[] },
  sampleError: undefined as Error | undefined,
  entriesError: undefined as Error | undefined,
  retrySamples: vi.fn(),
  retryEntries: vi.fn(),
}));
beforeEach(() => {
  stable.sampleError = undefined;
  stable.entriesError = undefined;
  vi.clearAllMocks();
});
vi.mock(
  "@/features/symptoms/control-tower/control-tower-api",
  async (original) => ({
    ...(await original<object>()),
    useScriptSamples: () => ({
      data: stable.sampleError
        ? undefined
        : [
            {
              symptom_id: -1,
              asset_id: "TEST-PLATE",
              opened_at: "2026-01-01T00:00:00Z",
            },
          ],
      error: stable.sampleError,
      mutate: stable.retrySamples,
    }),
    useCaseTimeline: () => ({
      data: stable.entriesError
        ? undefined
        : [
            { kind: "CLOSED", at: "2026-01-01T00:01:00Z", context: null },
            {
              kind: "CLOSED",
              at: "2026-01-01T00:02:00Z",
              context: { case: {} },
            },
          ],
      error: stable.entriesError,
      mutate: stable.retryEntries,
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
    tripInactive: "Sin viaje activo",
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
  it("preserves a positive sub-hour age when editing", () => {
    const r = rules({ close: "case.age_h >= 0.5" });
    render(
      <CloseRules
        rules={r}
        mode="form"
        readOnly={false}
        d={d}
        onExpr={vi.fn()}
      />
    );
    const hours = screen.getByLabelText<HTMLInputElement>("Pasan");
    expect(hours.value).toBe("0.5");
    expect(hours.step).toBe("any");
    fireEvent.change(hours, { target: { value: "" } });
    expect(hours.value).toBe("");
    fireEvent.change(hours, { target: { value: "0" } });
    expect(hours.value).toBe("0");
    expect(r.onChange).not.toHaveBeenCalled();
    fireEvent.change(hours, { target: { value: "0.25" } });
    expect(r.onChange).toHaveBeenCalledWith({
      close: "case.age_h >= 0.25",
      note: null,
    });
  });

  it.each(["", "0", "-1"])(
    "does not replace an age threshold with invalid input %j",
    (value) => {
      const r = rules({ close: "case.age_h >= 0.5" });
      render(
        <CloseRules
          rules={r}
          mode="form"
          readOnly={false}
          d={d}
          onExpr={vi.fn()}
        />
      );
      fireEvent.change(screen.getByLabelText("Pasan"), { target: { value } });
      expect(r.onChange).not.toHaveBeenCalled();
      fireEvent.blur(screen.getByLabelText("Pasan"));
      expect(screen.getByLabelText<HTMLInputElement>("Pasan").value).toBe(
        "0.5"
      );
    }
  );

  it("names the trip predicate as current inactivity rather than a historical trip-end event", () => {
    render(
      <CloseRules
        rules={rules({
          close: "!signal.trip.active",
          fields: [...FIELDS, { path: "signal.trip.active", detail: "" }],
        })}
        mode="form"
        readOnly={false}
        d={d}
        onExpr={vi.fn()}
      />
    );
    expect(
      screen.getByLabelText<HTMLSelectElement>("Cómo se cierra").value
    ).toBe("tripInactive");
    expect(
      screen.getByRole("option", { name: "Sin viaje activo" })
    ).toBeTruthy();
  });

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
  const dict = es.pages.userSettings.symptomCatalog;
  it("shows and retries a failed case lookup instead of an empty-case message", () => {
    stable.sampleError = new Error("unavailable");
    render(
      <CaseTimelinePreview symptomName="Synthetic symptom" icu={4} d={dict} />
    );
    expect(screen.getByRole("alert").textContent).toContain(
      dict.timelineSamplesError
    );
    expect(screen.queryByText(dict.timelineNone)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: dict.scriptRetrySamples })
    );
    expect(stable.retrySamples).toHaveBeenCalledOnce();
    expect(stable.retryEntries).not.toHaveBeenCalled();
  });

  it("shows and retries a failed timeline lookup", () => {
    stable.entriesError = new Error("unavailable");
    render(
      <CaseTimelinePreview symptomName="Synthetic symptom" icu={4} d={dict} />
    );
    expect(screen.getByRole("alert").textContent).toContain(
      dict.timelineEntriesError
    );
    fireEvent.click(
      screen.getByRole("button", { name: dict.scriptRetrySamples })
    );
    expect(stable.retryEntries).toHaveBeenCalledOnce();
    expect(stable.retrySamples).not.toHaveBeenCalled();
  });

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
