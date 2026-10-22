import { describe, expect, it } from "vitest";
import {
  decisionDe,
  detectarConflictos,
  mismaForma,
  opcionesDecision,
  planImport,
  seTocan,
  type FilaConUid,
} from "./import-conflicts";
import type { LatLon, Lugar } from "../places.types";

const cuadrado = (la: number, lo: number, lado = 0.01): LatLon[] => [
  [la, lo],
  [la + lado, lo],
  [la + lado, lo + lado],
  [la, lo + lado],
];

const fila = (uid: string, vertices: LatLon[]): FilaConUid => ({
  uid,
  name: uid,
  lat: vertices[0]![0],
  lon: vertices[0]![1],
  geometry_type: "polygon",
  vertices,
});

const lugar = (place_id: string, polygon: LatLon[]): Lugar => ({
  place_id,
  name: place_id,
  address: null,
  category: null,
  category_id: null,
  geometry_type: "polygon",
  color: null,
  center: polygon[0]!,
  polygon,
  radius_m: null,
  metadata: null,
  external_id: null,
  active_from: null,
  active_until: null,
});

describe("import conflicts", () => {
  it("is total only with exactly the same numbers on every point", () => {
    const a = { tipo: "poligono" as const, vertices: cuadrado(0, 0) };
    const reordenado = {
      tipo: "poligono" as const,
      vertices: [...cuadrado(0, 0)].reverse(),
    };
    expect(mismaForma(a, reordenado)).toBe(true);
    const casi = {
      tipo: "poligono" as const,
      vertices: cuadrado(0, 0.0000001),
    };
    expect(mismaForma(a, casi)).toBe(false);
    expect(
      mismaForma(
        { tipo: "circulo", lat: 1, lon: 1, radio: 20 },
        { tipo: "circulo", lat: 1, lon: 1, radio: 20 }
      )
    ).toBe(true);
  });

  it("is partial when shapes touch without being equal", () => {
    const a = { tipo: "poligono" as const, vertices: cuadrado(0, 0) };
    const solapa = {
      tipo: "poligono" as const,
      vertices: cuadrado(0.005, 0.005),
    };
    const lejos = { tipo: "poligono" as const, vertices: cuadrado(1, 1) };
    expect(seTocan(a, solapa)).toBe(true);
    expect(seTocan(a, lejos)).toBe(false);
    // a circle inside a polygon also touches
    expect(
      seTocan(a, { tipo: "circulo", lat: 0.005, lon: 0.005, radio: 50 })
    ).toBe(true);
  });

  it("flags rows against saved places and against earlier rows", () => {
    const filas = [
      fila("igual", cuadrado(0, 0)),
      fila("solapa", cuadrado(0.005, 0.005)),
      fila("sola", cuadrado(5, 5)),
    ];
    const cs = detectarConflictos(filas, [lugar("p1", cuadrado(0, 0))]);
    expect(cs.get("igual")).toEqual([
      expect.objectContaining({ tipo: "total" }),
    ]);
    // overlaps the saved place and the earlier row
    expect(cs.get("solapa")?.map((c) => [c.tipo, c.con.tipo])).toEqual([
      ["parcial", "lugar"],
      ["parcial", "fila"],
    ]);
    expect(cs.has("sola")).toBe(false);
  });

  it("offers both only when no conflict is total", () => {
    const total = [
      {
        tipo: "total" as const,
        con: { tipo: "fila" as const, uid: "x", name: "x" },
      },
    ];
    const parcial = [
      {
        tipo: "parcial" as const,
        con: { tipo: "fila" as const, uid: "x", name: "x" },
      },
    ];
    expect(opcionesDecision(total)).toEqual(["existente", "nuevo"]);
    expect(opcionesDecision(parcial)).toEqual(["existente", "nuevo", "ambos"]);
    expect(decisionDe(total, undefined)).toBe("existente");
    expect(decisionDe(parcial, undefined)).toBe("ambos");
    // an option no longer valid falls back to the default
    expect(decisionDe(total, "ambos")).toBe("existente");
  });

  it("plans the import from each row's decision", () => {
    const p1 = lugar("p1", cuadrado(0, 0));
    const filas = [
      fila("igual", cuadrado(0, 0)),
      fila("nueva", cuadrado(5, 5)),
      fila("tapa", cuadrado(5.005, 5.005)),
    ];
    const cs = detectarConflictos(filas, [p1]);

    // defaults: the total keeps the saved place; the partial keeps both
    const porDefecto = planImport(filas, cs, {});
    expect(porDefecto.crear.map((f) => f.uid)).toEqual(["nueva", "tapa"]);
    expect(porDefecto.actualizar).toEqual([]);

    // "nuevo": the import replaces the saved place and the earlier row
    const nuevo = planImport(filas, cs, { igual: "nuevo", tapa: "nuevo" });
    expect(nuevo.actualizar).toEqual([{ lugar: p1, fila: filas[0] }]);
    expect(nuevo.crear.map((f) => f.uid)).toEqual(["tapa"]);
    expect(nuevo.borrar).toEqual([]);
  });
});

describe("route import conflicts", () => {
  const ruta = (
    uid: string,
    waypoints: LatLon[],
    tipos: ("parada" | "desvio")[]
  ): FilaConUid => ({
    uid,
    name: uid,
    lat: waypoints[0]![0],
    lon: waypoints[0]![1],
    geometry_type: "line",
    points: waypoints,
    waypoints,
    tipos_puntos: tipos,
  });
  const wps: LatLon[] = [
    [0, 0],
    [0.5, 0.5],
    [1, 1],
  ];
  const guardado = {
    trayecto_id: "t1",
    name: "Guardado",
    kind: "vial",
    width_m: 30,
    points: wps,
    waypoints: wps,
    parent_name: null,
    ajustado: false,
    external_id: null,
    tipos_puntos: ["parada", "desvio", "parada"] as ("parada" | "desvio")[],
  };

  it("is a conflict only with the same start, end, inner points and types", () => {
    const filas = [
      ruta("igual", wps, ["parada", "desvio", "parada"]),
      ruta("otro-tipo", wps, ["parada", "parada", "parada"]),
    ];
    const cs = detectarConflictos(filas, [], [guardado]);
    expect(cs.get("igual")?.[0]).toEqual({
      tipo: "total",
      con: { tipo: "trayecto", trayecto: guardado },
    });
    // same points, but a stop where the saved one has a deviation
    expect(cs.has("otro-tipo")).toBe(false);
  });

  it("updates the saved route when the new one is kept", () => {
    const filas = [ruta("igual", wps, ["parada", "desvio", "parada"])];
    const cs = detectarConflictos(filas, [], [guardado]);
    const plan = planImport(filas, cs, { igual: "nuevo" });
    expect(plan.actualizarTrayectos).toEqual([
      { trayecto: guardado, fila: filas[0] },
    ]);
    expect(plan.crear).toEqual([]);
    // by default the saved one stays and the row is not imported
    expect(planImport(filas, cs, {}).crear).toEqual([]);
  });
});
