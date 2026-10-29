import { describe, expect, it } from "vitest";
import {
  SIN_CATEGORIA,
  categoriasDeLugares,
  filtrarLugares,
  filtrarPorCategoria,
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

describe("category filter", () => {
  const xs = [
    lugar({ place_id: "a", category: "Zona de riesgo" }),
    lugar({ place_id: "b", category: null }),
    lugar({ place_id: "c", category: "General" }),
    lugar({ place_id: "d", category: "Zona de riesgo" }),
  ];

  it("lists each category once with its count, uncategorized last", () => {
    expect(categoriasDeLugares(xs)).toEqual([
      { categoria: "General", total: 1 },
      { categoria: "Zona de riesgo", total: 2 },
      { categoria: SIN_CATEGORIA, total: 1 },
    ]);
  });

  it("keeps only the chosen category, or everything with none", () => {
    expect(
      filtrarPorCategoria(xs, "Zona de riesgo").map((l) => l.place_id)
    ).toEqual(["a", "d"]);
    expect(
      filtrarPorCategoria(xs, SIN_CATEGORIA).map((l) => l.place_id)
    ).toEqual(["b"]);
    expect(filtrarPorCategoria(xs, "")).toBe(xs);
  });
});
