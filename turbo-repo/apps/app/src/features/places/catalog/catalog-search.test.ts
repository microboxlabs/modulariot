import { describe, expect, it } from "vitest";
import { filtrarLugares, filtrarTrayectos } from "./catalog-search";
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
  it("includes the same whole family regardless of sibling ordering", () => {
    const parent = lugar({ place_id: "parent", name: "Demo parent" });
    const other = lugar({
      place_id: "other",
      name: "Other",
      metadata: { [PARENT_KEY]: "parent" },
    });
    const match = lugar({
      place_id: "match",
      name: "Matching demo",
      metadata: { [PARENT_KEY]: "parent" },
    });
    for (const ordered of [
      [parent, other, match],
      [parent, match, other],
      [match, other, parent],
    ]) {
      expect(
        filtrarLugares(ordered, "matching")
          .map((place) => place.place_id)
          .sort()
      ).toEqual(["match", "other", "parent"]);
    }
  });
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
