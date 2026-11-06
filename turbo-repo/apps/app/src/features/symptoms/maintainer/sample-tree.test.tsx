import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editor = vi.hoisted(() => ({ insertIntoFocused: vi.fn() }));
vi.mock("./cel-editor", () => editor);

import type { Preview } from "./maintainer-api";
import type { SourceField } from "./maintainer-api";
import SampleTree, {
  celFieldInfos,
  fieldInfos,
  fold,
  sampleLabel,
  useSourceSamples,
  visiblePaths,
} from "./sample-tree";

const d = {
  insertField: "Insertar {path}",
  sampleOf: "Muestra {n} de {total}",
  previousSample: "Anterior",
  nextSample: "Siguiente",
  fieldFilter: "Filtrar campos",
  noFieldMatches: "Sin resultados",
  clearFieldFilter: "Limpiar filtro de campos",
  originTrip: "Viaje",
};

const FIELDS: SourceField[] = [
  {
    path: "signal.trip.age_min",
    label: "Tiempo en viaje",
    type: "number",
    unit: "min",
    origin: "TRIP",
    engineSupported: true,
  },
  {
    path: "signal.local_minutes",
    label: "Minutos del día",
    description: "Minutos desde la medianoche local",
    type: "number",
    unit: "min",
    origin: null,
    engineSupported: true,
  },
  {
    path: "signal.vehicle.weight_kg",
    label: "Peso máximo",
    type: "number",
    unit: "kg",
    origin: null,
    engineSupported: true,
  },
];

const ENRICHED = {
  signal: {
    trip: { active: true, age_min: 42 },
    vehicle: { weight_kg: 28400 },
    local_minutes: 90.5,
  },
};

const SAMPLES = [
  {
    signal: {
      vehicle: { plate: "AB1234", weight_kg: 28400 },
      trip: { active: true, route: "Ruta 5" },
      zone: null,
    },
  },
  { signal: { trip: { active: false } } },
];

describe("sampleLabel", () => {
  it("reads plate, route and time when the sample has them", () => {
    const label = sampleLabel({
      signal: {
        received_at: "2026-09-29T21:31:04-03:00",
        vehicle: { plate: "AB1234" },
        trip: { route: "Ruta 5" },
      },
    });
    expect(label).toMatch(/^AB1234 · Ruta 5 · \d{1,2}:\d{2}/);
    expect(sampleLabel({ signal: { received_at: "no es fecha" } })).toBeNull();
    expect(sampleLabel({ signal: { trip: { active: true } } })).toBeNull();
  });
});

describe("SampleTree", () => {
  beforeEach(() => editor.insertIntoFocused.mockReset());

  it("inserts a field's path on click and offers it to drag", () => {
    render(
      <SampleTree
        samples={SAMPLES}
        index={0}
        readOnly={false}
        d={d}
        onIndex={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "vehicle" }));
    const leaf = screen.getByLabelText("Insertar signal.vehicle.weight_kg");
    expect(leaf.textContent).toBe("weight_kg : 28400");
    fireEvent.click(leaf);
    expect(editor.insertIntoFocused).toHaveBeenCalledWith(
      "signal.vehicle.weight_kg"
    );
    const setData = vi.fn();
    fireEvent.dragStart(leaf, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "signal.vehicle.weight_kg"
    );
    expect(screen.getByLabelText("Insertar signal.zone").textContent).toBe(
      "zone : null"
    );
    expect(screen.getByText("AB1234 · Ruta 5")).toBeTruthy();
  });

  it("shows held_s in the header without offering it as a field", () => {
    render(
      <SampleTree
        samples={[{ signal: { trip: { active: true } }, held_s: 75 }]}
        index={0}
        readOnly={false}
        d={{ ...d, sampleHeld: "Sostenida {seconds} s" }}
        onIndex={vi.fn()}
      />
    );
    expect(screen.getByText("Sostenida 75 s")).toBeTruthy();
    expect(screen.queryByLabelText("Insertar held_s")).toBeNull();
  });

  it("starts with nested objects closed, opens a branch and changes sample", () => {
    const onIndex = vi.fn();
    render(
      <SampleTree
        samples={SAMPLES}
        index={0}
        readOnly={false}
        d={d}
        onIndex={onIndex}
      />
    );
    const signal = screen.getByRole("button", { name: "signal" });
    expect(signal.getAttribute("aria-expanded")).toBe("true");
    const vehicle = screen.getByRole("button", { name: "vehicle" });
    expect(vehicle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Insertar signal.vehicle.plate")).toBeNull();
    fireEvent.click(vehicle);
    expect(vehicle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Insertar signal.vehicle.plate")).toBeTruthy();
    fireEvent.click(signal);
    expect(screen.queryByRole("button", { name: "vehicle" })).toBeNull();
    expect(
      (screen.getByLabelText("Anterior") as HTMLButtonElement).disabled
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Siguiente"));
    expect(onIndex).toHaveBeenCalledWith(1);
  });

  it("shows the sample without insert buttons for readers, and its number when it has no label", () => {
    render(
      <SampleTree
        samples={SAMPLES}
        index={1}
        readOnly
        d={d}
        onIndex={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "trip" }));
    expect(screen.queryAllByLabelText(/^Insertar/)).toHaveLength(0);
    expect(
      screen.getAllByText(
        (_, el) => el?.tagName === "DIV" && el.textContent === "active : false"
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("Muestra 2 de 2")).toBeTruthy();
    expect(
      (screen.getByLabelText("Siguiente") as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it("tags the fields the engine cannot read yet", () => {
    render(
      <SampleTree
        samples={SAMPLES}
        index={0}
        notInEngine={new Set(["signal.vehicle.weight_kg"])}
        readOnly={false}
        d={{ ...d, engineNotYetTag: "motor: aún no" }}
        onIndex={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "vehicle" }));
    expect(
      screen.getByLabelText("Insertar signal.vehicle.weight_kg").textContent
    ).toBe("weight_kg : 28400motor: aún no");
    expect(screen.getAllByText("motor: aún no")).toHaveLength(1);
  });

  it("renders nothing without samples", () => {
    const { container } = render(
      <SampleTree
        samples={[]}
        index={0}
        readOnly={false}
        d={d}
        onIndex={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("useSourceSamples", () => {
  const preview = (source: string, n: number): Preview => ({
    source,
    samples: [
      {
        sample: { n },
        activates: true,
        measure: null,
        level: null,
        error: null,
      },
    ],
  });

  it("keeps the last samples while a new preview is on its way", () => {
    const first = preview("gps_signal", 1);
    const { result, rerender } = renderHook(
      ({ p, source }) => useSourceSamples(p, source),
      {
        initialProps: {
          p: first as Preview | undefined,
          source: "gps_signal" as string | null,
        },
      }
    );
    expect(result.current).toBe(first.samples);
    rerender({ p: undefined, source: "gps_signal" });
    expect(result.current).toBe(first.samples);
    const second = preview("gps_signal", 2);
    rerender({ p: second, source: "gps_signal" });
    expect(result.current).toBe(second.samples);
  });

  it("drops another source's samples at once", () => {
    const { result, rerender } = renderHook(
      ({ p, source }) => useSourceSamples(p, source),
      {
        initialProps: {
          p: preview("gps_signal", 1) as Preview | undefined,
          source: "gps_signal" as string | null,
        },
      }
    );
    rerender({ p: undefined, source: "trip_check" });
    expect(result.current).toEqual([]);
    rerender({ p: preview("trip_check", 3), source: "trip_check" });
    expect(result.current[0]?.sample).toEqual({ n: 3 });
  });
});

describe("fold and visiblePaths", () => {
  const infos = fieldInfos(FIELDS, d);

  it("folds case and accents without moving the text", () => {
    expect(fold("Minutos del DÍA")).toBe("minutos del dia");
    expect(fold("DÍA".normalize("NFD"))).toBe("dia");
    expect(fold("Año")).toHaveLength(3);
  });

  it("matches the path, the label or the description and keeps the parents", () => {
    expect([...(visiblePaths(ENRICHED, "age_min", infos) ?? [])]).toEqual([
      "signal.trip.age_min",
      "signal.trip",
      "signal",
    ]);
    expect(visiblePaths(ENRICHED, "tiempo EN viaje", infos)).toEqual(
      new Set(["signal", "signal.trip", "signal.trip.age_min"])
    );
    expect(visiblePaths(ENRICHED, "medianoche", infos)).toEqual(
      new Set(["signal", "signal.local_minutes"])
    );
  });

  it("ignores accents in the query and in the fields", () => {
    expect(
      visiblePaths(ENRICHED, "dia", infos)?.has("signal.local_minutes")
    ).toBe(true);
    expect(
      visiblePaths(ENRICHED, "PÉSO", infos)?.has("signal.vehicle.weight_kg")
    ).toBe(true);
  });

  it("is null without a filter and empty when nothing matches", () => {
    expect(visiblePaths(ENRICHED, "  ", infos)).toBeNull();
    expect(visiblePaths(ENRICHED, "zzz", infos)?.size).toBe(0);
  });
});

describe("SampleTree with field infos", () => {
  beforeEach(() => editor.insertIntoFocused.mockReset());

  const renderTree = () =>
    render(
      <SampleTree
        samples={[ENRICHED]}
        index={0}
        fields={fieldInfos(FIELDS, d)}
        readOnly={false}
        d={d}
        onIndex={vi.fn()}
      />
    );

  it("shows each field's label, description, unit and origin", () => {
    renderTree();
    fireEvent.click(screen.getByRole("button", { name: "trip" }));
    expect(
      screen.getByLabelText("Insertar signal.trip.age_min").textContent
    ).toBe("age_min : 42Tiempo en viaje · min · Viaje");
    expect(
      screen.getByLabelText("Insertar signal.local_minutes").textContent
    ).toBe(
      "local_minutes : 90.5Minutos del día — Minutos desde la medianoche local · min"
    );
    // A field the source does not describe shows only its value.
    expect(
      screen.getByLabelText("Insertar signal.trip.active").textContent
    ).toBe("active : true");
  });

  it("filters as you type, keeps the parents open and marks the match", () => {
    renderTree();
    fireEvent.change(screen.getByLabelText("Filtrar campos"), {
      target: { value: "viaje" },
    });
    expect(screen.getByRole("button", { name: "signal" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "trip" }).getAttribute("aria-expanded")
    ).toBe("true");
    expect(screen.getByLabelText("Insertar signal.trip.age_min")).toBeTruthy();
    expect(screen.queryByLabelText("Insertar signal.trip.active")).toBeNull();
    expect(screen.queryByRole("button", { name: "vehicle" })).toBeNull();
    expect(screen.getByText("viaje", { selector: "mark" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Insertar signal.trip.age_min"));
    expect(editor.insertIntoFocused).toHaveBeenCalledWith(
      "signal.trip.age_min"
    );
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByLabelText("Insertar signal.trip.age_min"), {
      dataTransfer: { setData },
    });
    expect(setData).toHaveBeenCalledWith("text/plain", "signal.trip.age_min");
    fireEvent.click(screen.getByLabelText("Limpiar filtro de campos"));
    expect(screen.getByLabelText("Filtrar campos")).toHaveValue("");
    expect(screen.getByRole("button", { name: "trip" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(screen.getByRole("button", { name: "vehicle" })).toBeTruthy();
  });

  it("uses the rule editor's localized case metadata and English controls", () => {
    const english = {
      insertField: "Insert {path}",
      fieldFilter: "Filter fields",
      clearFieldFilter: "Clear field filter",
      noFieldMatches: "No results",
    };
    render(
      <SampleTree
        samples={[{ case: { age_h: 2 } }]}
        index={0}
        fields={celFieldInfos([
          {
            path: "case.age_h",
            description: "hours since the case opened",
            unit: "h",
          },
        ])}
        readOnly={false}
        d={english}
        onIndex={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Filter fields"), {
      target: { value: "opened" },
    });
    expect(screen.getByLabelText("Insert case.age_h")).toHaveTextContent(
      "hours since the case opened · h"
    );
    fireEvent.click(screen.getByLabelText("Clear field filter"));
    expect(screen.getByLabelText("Filter fields")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Filter fields"), {
      target: { value: "no matching field" },
    });
    expect(screen.getByText("No results")).toBeTruthy();
  });

  it("says so when nothing matches", () => {
    renderTree();
    fireEvent.change(screen.getByLabelText("Filtrar campos"), {
      target: { value: "nada que ver" },
    });
    expect(screen.getByText("Sin resultados")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "signal" })).toBeNull();
  });

  it("opens the first group only", () => {
    render(
      <SampleTree
        samples={[{ case: { level: 2 }, signal: { trip: { active: true } } }]}
        index={0}
        readOnly={false}
        d={d}
        onIndex={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: "case" }).getAttribute("aria-expanded")
    ).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "signal" })
        .getAttribute("aria-expanded")
    ).toBe("false");
  });
});
