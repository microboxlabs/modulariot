import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const editor = vi.hoisted(() => ({ insertIntoFocused: vi.fn() }));
vi.mock("./cel-editor", () => editor);

import { FieldsPanel, withAllFields } from "./fields-panel";
import type { DataSource, SourceField } from "./maintainer-api";

const d = {
  fieldsOf: "Campos · {source}",
  fieldsHint: "Toca un campo",
  insertField: "Insertar {path}",
  sampleOf: "Muestra {n} de {total}",
  previousSample: "Anterior",
  nextSample: "Siguiente",
  fieldFilter: "Filtrar campos",
  noFieldMatches: "Sin resultados",
  clearFieldFilter: "Limpiar filtro de campos",
  engineNotYetTag: "motor: aún no",
  originTrip: "Viaje",
};

const FIELDS: SourceField[] = [
  {
    path: "signal.speed",
    label: "Velocidad",
    description: "Velocidad reportada por el GPS",
    type: "number",
    unit: "km/h",
    origin: null,
    engineSupported: true,
  },
  {
    path: "signal.trip.age_min",
    label: "Tiempo en viaje",
    type: "number",
    unit: "min",
    origin: "TRIP",
    engineSupported: false,
  },
  {
    path: "signal.events",
    label: "Eventos",
    type: "objects",
    unit: null,
    origin: null,
    engineSupported: true,
  },
  {
    path: "signal.events.event_type",
    label: "Tipo de evento",
    type: "string",
    unit: null,
    origin: null,
    engineSupported: true,
  },
];

const SOURCE: DataSource = {
  id: "s1",
  tenantCode: null,
  key: "gps",
  name: "Señal GPS enriquecida",
  kind: "SIGNAL",
  root: "signal",
  cadence: null,
  fields: FIELDS,
  samples: [{ signal: { speed: 72, events: [{ event_type: "ign_on" }] } }],
};

const filter = () => screen.getByPlaceholderText("Filtrar campos");

describe("withAllFields", () => {
  it("adds the fields the sample lacks, without a list's own fields", () => {
    expect(withAllFields({ signal: { speed: 1 } }, FIELDS)).toEqual({
      signal: { speed: 1, trip: { age_min: undefined }, events: undefined },
    });
  });
});

describe("FieldsPanel", () => {
  beforeEach(() => editor.insertIntoFocused.mockReset());

  it("shows the fields as the tree, with meaning, unit, origin and the engine tag", () => {
    render(<FieldsPanel source={SOURCE} d={d} />);
    expect(screen.getByText("Campos · Señal GPS enriquecida")).toBeTruthy();
    expect(screen.getByLabelText("Insertar signal.speed").textContent).toBe(
      "speed : 72Velocidad — Velocidad reportada por el GPS · km/h"
    );
    fireEvent.click(screen.getByRole("button", { name: "trip" }));
    expect(
      screen.getByLabelText("Insertar signal.trip.age_min").textContent
    ).toBe("age_minmotor: aún noTiempo en viaje · min · Viaje");
    expect(
      screen.getByLabelText("Insertar signal.events").textContent
    ).toContain("event_type — Tipo de evento");
    expect(
      screen.queryByLabelText("Insertar signal.events.event_type")
    ).toBeNull();
  });

  it("filters by path, title and description", () => {
    render(<FieldsPanel source={SOURCE} d={d} />);
    fireEvent.change(filter(), { target: { value: "age_min" } });
    expect(screen.getByLabelText("Insertar signal.trip.age_min")).toBeTruthy();
    expect(screen.queryByLabelText("Insertar signal.speed")).toBeNull();
    fireEvent.change(filter(), { target: { value: "tiempo en viaje" } });
    expect(screen.getByLabelText("Insertar signal.trip.age_min")).toBeTruthy();
    fireEvent.change(filter(), { target: { value: "reportada" } });
    expect(screen.getByLabelText("Insertar signal.speed")).toBeTruthy();
    expect(screen.queryByLabelText("Insertar signal.trip.age_min")).toBeNull();
    fireEvent.change(filter(), { target: { value: "tipo de evento" } });
    expect(screen.getByLabelText("Insertar signal.events")).toBeTruthy();
    fireEvent.change(filter(), { target: { value: "zzz" } });
    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });

  it("inserts a field's path, and a list's condition with the caret inside the quotes", () => {
    render(<FieldsPanel source={SOURCE} d={d} />);
    fireEvent.click(screen.getByLabelText("Insertar signal.speed"));
    expect(editor.insertIntoFocused).toHaveBeenLastCalledWith("signal.speed");
    const list = screen.getByLabelText("Insertar signal.events");
    fireEvent.click(list);
    const text = 'signal.events.exists(e, e.event_type == "")';
    expect(editor.insertIntoFocused).toHaveBeenLastCalledWith(
      text,
      text.length - 2
    );
    const setData = vi.fn();
    fireEvent.dragStart(list, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", text);
  });

  it("shows every field when the source has no samples", () => {
    render(<FieldsPanel source={{ ...SOURCE, samples: [] }} d={d} />);
    expect(screen.getByLabelText("Insertar signal.speed").textContent).toBe(
      "speedVelocidad — Velocidad reportada por el GPS · km/h"
    );
  });
});
