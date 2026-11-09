import { fireEvent, render, screen, within } from "@testing-library/react";
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

  it.each([null, undefined])(
    "keeps catalog fields below a %s sample object without changing the sample",
    (trip) => {
      const sample = { signal: { speed: 1, trip } };
      expect(withAllFields(sample, FIELDS)).toEqual({
        signal: { speed: 1, trip: { age_min: undefined }, events: undefined },
      });
      expect(sample).toEqual({ signal: { speed: 1, trip } });
    }
  );

  it("projects only catalog paths and clones their sample values", () => {
    const events = [{ event_type: "ign_on" }];
    const sample = {
      debug: true,
      signal: {
        speed: 42,
        debug_code: "private",
        trip: { age_min: 7, debug: true },
        events,
      },
    };
    const projected = withAllFields(sample, FIELDS);
    expect(projected).toEqual({
      signal: { speed: 42, trip: { age_min: 7 }, events },
    });
    expect((projected.signal as Record<string, unknown>).events).not.toBe(
      events
    );
    expect(sample.signal.debug_code).toBe("private");
  });

  it.each([
    undefined,
    Object.fromEntries([
      ["__proto__", { constructor: { x: 7 } }],
      ["constructor", { prototype: { x: 9 } }],
    ]),
  ])("keeps prototype-sensitive paths as own data with sample %j", (sample) => {
    const fields = ["__proto__.constructor.x", "constructor.prototype.x"].map(
      (path) => ({ ...FIELDS[0]!, path })
    );
    const descriptor = Object.getOwnPropertyDescriptor(
      Object.prototype,
      "constructor"
    )!;
    let projected: ReturnType<typeof withAllFields> = {};
    let intact = false;
    try {
      projected = withAllFields(sample, fields);
      intact = Object.prototype.constructor === descriptor.value;
    } finally {
      Object.defineProperty(Object.prototype, "constructor", descriptor);
    }
    expect(intact).toBe(true);
    expect(Object.getPrototypeOf(projected)).toBe(Object.prototype);
    expect(Object.hasOwn(projected, "__proto__")).toBe(true);
    expect(Object.hasOwn(projected, "constructor")).toBe(true);
    expect(Object.entries(projected)).toEqual([
      ["__proto__", { constructor: { x: sample ? 7 : undefined } }],
      ["constructor", { prototype: { x: sample ? 9 : undefined } }],
    ]);
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

  it("does not offer paths that exist only in the sample", () => {
    render(
      <FieldsPanel
        source={{
          ...SOURCE,
          samples: [{ signal: { speed: 72, debug_code: "private" } }],
        }}
        d={d}
      />
    );
    expect(screen.getByLabelText("Insertar signal.speed")).toBeTruthy();
    expect(screen.queryByLabelText("Insertar signal.debug_code")).toBeNull();
    fireEvent.change(filter(), { target: { value: "debug_code" } });
    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });

  it("warns about unsupported list members even when their list is supported", () => {
    render(
      <FieldsPanel
        source={{
          ...SOURCE,
          fields: [
            ...FIELDS,
            {
              ...FIELDS[3]!,
              path: "signal.events.code",
              label: "Código",
              engineSupported: false,
            },
          ],
        }}
        d={d}
      />
    );
    fireEvent.change(filter(), { target: { value: "code" } });
    const list = screen.getByLabelText("Insertar signal.events");
    expect(within(list).getByText("code")).toBeTruthy();
    expect(within(list).getByText("motor: aún no")).toBeTruthy();
    expect(screen.queryByLabelText("Insertar signal.events.code")).toBeNull();
  });

  it("keeps missing fields available while navigating samples", () => {
    render(
      <FieldsPanel
        source={{
          ...SOURCE,
          samples: [...SOURCE.samples, { signal: { trip: null } }],
        }}
        d={d}
      />
    );
    fireEvent.click(screen.getByLabelText("Siguiente"));
    fireEvent.change(filter(), { target: { value: "age_min" } });
    expect(
      screen.getByLabelText("Insertar signal.trip.age_min")
    ).toHaveTextContent("Tiempo en viaje");
    fireEvent.click(screen.getByLabelText("Anterior"));
    expect(screen.getByLabelText("Insertar signal.trip.age_min")).toBeTruthy();
  });

  it.each([
    ["signal.road.maxspeed_osm", "Límite de la vía", "number", "ROAD_NETWORK"],
    ["signal.road.maxspeed_custom", "Límite propio", "number", null],
    ["signal.road.osm_way_id", "Vía OSM", "number", "ROAD_NETWORK"],
    ["signal.road.road_class", "Tipo de vía", "text", "ROAD_NETWORK"],
    [
      "signal.road.custom_zone_id",
      "Zona de límite propio",
      "number",
      "TENANT_SETTINGS",
    ],
    ["signal.trip.eta_deviation_min", "Desvío de llegada", "number", "TRIP"],
    ["signal.trip.origin.internal", "Origen interno", "bool", "TRIP"],
    [
      "signal.derived.power_disconnected",
      "Alimentación desconectada",
      "bool",
      "DEVICE",
    ],
    ["signal.derived.jamming", "Inhibición de señal", "bool", "DEVICE"],
    ["signal.frame.events.code", "Código del evento", "text", "DEVICE"],
    ["check.driving_minutes", "Minutos conduciendo", "number", "CALCULATED"],
    ["check.resting_minutes", "Minutos de descanso", "number", "CALCULATED"],
    ["check.duty_minutes", "Minutos de jornada", "number", "CALCULATED"],
  ] satisfies [string, string, string, SourceField["origin"]][])(
    "shows and inserts the new catalog field %s even without a sample value",
    (path, label, type, origin) => {
      const field: SourceField = {
        path,
        label,
        type,
        origin,
        unit: null,
        engineSupported: true,
        description: `Descripción de ${label}`,
      };
      const root = path.split(".")[0]!;
      const isMember = path === "signal.frame.events.code";
      const fields = isMember
        ? [{ ...FIELDS[2]!, path: "signal.frame.events" }, field]
        : [field];
      render(
        <FieldsPanel
          source={{ ...SOURCE, root, fields, samples: [{ [root]: {} }] }}
          d={d}
        />
      );
      fireEvent.change(filter(), { target: { value: label } });
      const insertedPath = isMember ? "signal.frame.events" : path;
      const leaf = screen.getByLabelText(`Insertar ${insertedPath}`);
      expect(leaf).toHaveTextContent(label);
      if (!isMember) expect(leaf).toHaveTextContent(field.description!);
      fireEvent.click(leaf);
      if (isMember) {
        const text = 'signal.frame.events.exists(e, e.event_type == "")';
        expect(editor.insertIntoFocused).toHaveBeenLastCalledWith(
          text,
          text.length - 2
        );
      } else {
        expect(editor.insertIntoFocused).toHaveBeenLastCalledWith(path);
      }
    }
  );
});
