import { describe, expect, it } from "vitest";
import {
  filtrarLugares,
  filtrarPorEtiquetas,
  filtrarTrayectos,
} from "./catalog-search";
import { PARENT_KEY, type Lugar, type Trayecto } from "../places.types";

const lugar = (over: Partial<Lugar>): Lugar => ({
  place_id: "p1",
  name: "Planta Norte",
  address: "Ruta 5",
  category: "Planta",
  category_id: 1,
  geometry_type: "circle",
  color: null,
  center: [-33, -70],
  polygon: null,
  radius_m: 250,
  metadata: null,
  external_id: null,
  active_from: null,
  active_until: null,
  ...over,
});

const trayecto = (over: Partial<Trayecto>): Trayecto => ({
  trayecto_id: "t1",
  name: "Acceso norte",
  kind: "vial",
  width_m: 30,
  points: [
    [0, 0],
    [1, 1],
  ],
  waypoints: null,
  parent_name: null,
  ajustado: true,
  external_id: null,
  ...over,
});

describe("filtrarLugares", () => {
  it("keeps parent and children when the query matches either", () => {
    const xs = [
      lugar({ place_id: "park", name: "Estacionamiento" }),
      lugar({
        place_id: "lot",
        name: "Lote VIP",
        metadata: { [PARENT_KEY]: "park" },
      }),
    ];
    expect(filtrarLugares(xs, "vip").map((l) => l.place_id)).toEqual([
      "park",
      "lot",
    ]);
  });

  it("matches category as well as name", () => {
    const xs = [
      lugar({ name: "Sitio A", category: "geofence" }),
      lugar({ place_id: "p2", name: "Otro" }),
    ];
    expect(filtrarLugares(xs, "geofence").map((l) => l.name)).toEqual([
      "Sitio A",
    ]);
  });
});

describe("filtrarTrayectos", () => {
  it("hides trayectos that do not match the query", () => {
    const xs = [
      trayecto({}),
      trayecto({ trayecto_id: "t2", name: "Ruta geofence sur" }),
    ];
    expect(filtrarTrayectos(xs, "geofence").map((t) => t.name)).toEqual([
      "Ruta geofence sur",
    ]);
    expect(filtrarTrayectos(xs, "xyz")).toEqual([]);
  });
});

describe("filtrarPorEtiquetas", () => {
  const xs = [
    lugar({ place_id: "a", name: "Riesgo Norte", category: "Zona de riesgo" }),
    lugar({ place_id: "b", name: "Planta Sur", category: null }),
    lugar({ place_id: "c", name: "Copec Norte", category: "General" }),
    lugar({ place_id: "d", name: "Manzano", category: "Zona de riesgo" }),
  ];
  const ids = (ls: Lugar[]) => ls.map((l) => l.place_id);

  it("keeps everything without tags", () => {
    expect(filtrarPorEtiquetas(xs, [])).toBe(xs);
  });

  it("matches the tag's own field only, by contains and ignoring case", () => {
    expect(
      ids(filtrarPorEtiquetas(xs, [{ matchType: "category", value: "RIESGO" }]))
    ).toEqual(["a", "d"]);
    // "norte" is in names, never in a category
    expect(
      ids(filtrarPorEtiquetas(xs, [{ matchType: "category", value: "norte" }]))
    ).toEqual([]);
    expect(
      ids(filtrarPorEtiquetas(xs, [{ matchType: "name", value: "norte" }]))
    ).toEqual(["a", "c"]);
  });

  it("ors tags of one field and ands different fields", () => {
    expect(
      ids(
        filtrarPorEtiquetas(xs, [
          { matchType: "category", value: "riesgo" },
          { matchType: "category", value: "general" },
        ])
      )
    ).toEqual(["a", "c", "d"]);
    expect(
      ids(
        filtrarPorEtiquetas(xs, [
          { matchType: "category", value: "riesgo" },
          { matchType: "name", value: "norte" },
        ])
      )
    ).toEqual(["a"]);
  });

  it("keeps the parent geofence of a matching inner one", () => {
    const familia = [
      lugar({ place_id: "park", name: "Estacionamiento", category: null }),
      lugar({
        place_id: "lot",
        name: "Lote VIP",
        category: "VIP",
        metadata: { [PARENT_KEY]: "park" },
      }),
    ];
    expect(
      ids(
        filtrarPorEtiquetas(familia, [{ matchType: "category", value: "vip" }])
      )
    ).toEqual(["park", "lot"]);
  });
});
