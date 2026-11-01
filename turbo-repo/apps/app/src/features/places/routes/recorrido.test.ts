import { describe, expect, it, vi } from "vitest";
import { TRAY_VACIO, type FormTrayecto } from "../places.types";
import {
  MAX_PUNTOS,
  agregarPunto,
  elegirPunto,
  distintivos,
  puntosRecorrido,
  quitarPunto,
  reordenar,
  textoPunto,
  puntoDesdeMapa,
  recorridoDesdePts,
  rotularPunto,
  textoDesdeCoords,
  borrarRecorrido,
  confirmarRecorrido,
  deshacerRecorrido,
  editarRecorrido,
  insertarParada,
  marcarHistorialRecorrido,
  moverPunto,
  primerPuntoVacio,
  puedeConfirmar,
  puntosUbicados,
  rehacerRecorrido,
  tramosRecorrido,
  puntoSobreLinea,
  cambiarTipoPunto,
  tipoDe,
  tiposUbicados,
  waypointsDirections,
  longitudM,
  textoDistancia,
  cambiarCategoriaPunto,
  categoriasUbicadas,
} from "./recorrido";

const sug = (nombre: string, punto: [number, number]) => ({
  id: nombre,
  nombre,
  contexto: "",
  punto,
});

/** A y B elegidos. */
const base = (): FormTrayecto => {
  let t: FormTrayecto = { ...TRAY_VACIO };
  t = elegirPunto(t, "origen", sug("A", [0, 0]));
  return elegirPunto(t, "destino", sug("B", [9, 9]));
};
const ids = (t: FormTrayecto) => t.recorrido.map((p) => p.id);

describe("recorrido", () => {
  it("starts with an empty origin and destination", () => {
    expect(TRAY_VACIO.recorrido).toHaveLength(2);
    expect(puntosRecorrido({ ...TRAY_VACIO })).toBeNull();
  });

  it("labels points: A, numbered stops, unnumbered deviations, B", () => {
    const ds = distintivos([
      { id: "a", texto: "", punto: null },
      { id: "1", texto: "", punto: null },
      { id: "d", texto: "", punto: null, tipo: "desvio" },
      { id: "2", texto: "", punto: null },
      { id: "b", texto: "", punto: null },
    ]);
    // stops are numbered among themselves; deviations have no number
    expect(ds.map((d) => d.letra)).toEqual(["A", "1", "", "2", "B"]);
    expect(ds.map((d) => d.label)).toEqual([
      "Desde",
      "Parada 1",
      "Desvío 1",
      "Parada 2",
      "Hasta",
    ]);
  });

  it("adds new points before the destination", () => {
    const t = agregarPunto(base());
    expect(t.recorrido).toHaveLength(3);
    expect(t.recorrido[2]!.id).toBe("destino");
  });

  it("is complete in list order, ignoring empty points", () => {
    let t = agregarPunto(base());
    expect(puntosRecorrido(t)).toEqual([
      [0, 0],
      [9, 9],
    ]);
    const nuevo = t.recorrido[1]!.id;
    t = elegirPunto(t, nuevo, sug("Uno", [1, 1]));
    expect(puntosRecorrido(t)).toEqual([
      [0, 0],
      [1, 1],
      [9, 9],
    ]);
  });

  it("waits while a point has text but no picked address", () => {
    let t = agregarPunto(base());
    t = textoPunto(t, t.recorrido[1]!.id, "algo");
    expect(puntosRecorrido(t)).toBeNull();
  });

  it("reorders by drag result and invalidates the route", () => {
    let t = agregarPunto(base());
    t = { ...t, pts: [[5, 5]], ajustado: true };
    const [a, m, b] = ids(t);
    const r = reordenar(t, [m!, a!, b!]);
    expect(ids(r)).toEqual([m, a, b]);
    expect(r.pts).toEqual([]);
    expect(r.ajustado).toBe(false);
    // same order or unknown ids: no change
    expect(reordenar(t, [a!, m!, b!])).toBe(t);
    expect(reordenar(t, [a!, b!])).toBe(t);
  });

  it("places a point from a map click without dropping the route later", () => {
    const t = puntoDesdeMapa(
      { ...TRAY_VACIO },
      "origen",
      [-33.4, -70.6],
      textoDesdeCoords([-33.4, -70.6])
    );
    expect(t.recorrido[0]?.punto).toEqual([-33.4, -70.6]);
    expect(t.recorrido[0]?.texto).toBe("-33.40000, -70.60000");
    const rotulado = rotularPunto(t, "origen", "Av. Libertador 1000");
    expect(rotulado.recorrido[0]?.texto).toBe("Av. Libertador 1000");
    expect(rotulado.recorrido[0]?.punto).toEqual([-33.4, -70.6]);
  });

  it("rebuilds origin and destination rows from saved waypoints", () => {
    expect(recorridoDesdePts([])).toEqual(TRAY_VACIO.recorrido);
    expect(recorridoDesdePts([[-33, -70]])).toEqual([
      { id: "origen", texto: textoDesdeCoords([-33, -70]), punto: [-33, -70] },
      { id: "destino", texto: "", punto: null },
    ]);
    const tres = recorridoDesdePts([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(tres.map((p) => p.id)).toEqual(["origen", "wp-1", "destino"]);
    expect(tres[1]?.punto).toEqual([1, 1]);
  });

  it("keeps at least two points and at most the routing limit", () => {
    const t = base();
    expect(quitarPunto(t, "origen")).toBe(t);
    let u = t;
    for (let i = 0; i < MAX_PUNTOS + 3; i++) u = agregarPunto(u);
    expect(u.recorrido).toHaveLength(MAX_PUNTOS);
    expect(quitarPunto(u, "origen").recorrido).toHaveLength(MAX_PUNTOS - 1);
  });

  describe("drawing on the map", () => {
    it("fills the next empty point from map clicks while drafting", () => {
      expect(primerPuntoVacio({ ...TRAY_VACIO })).toBe("origen");
      const t = puntoDesdeMapa({ ...TRAY_VACIO }, "origen", [1, 1], "x");
      expect(primerPuntoVacio(t)).toBe("destino");
      expect(primerPuntoVacio(base())).toBeNull();
      expect(primerPuntoVacio({ ...TRAY_VACIO, confirmado: true })).toBeNull();
    });

    it("stays a draft line until confirmed", () => {
      const t = base();
      expect(t.confirmado).toBe(false);
      expect(puntosUbicados(t)).toEqual([
        [0, 0],
        [9, 9],
      ]);
      expect(puedeConfirmar(t)).toBe(true);
      const ok = confirmarRecorrido(t);
      expect(ok.confirmado).toBe(true);
      expect(puedeConfirmar(ok)).toBe(false);
      // incomplete: nothing to confirm
      const solo = { ...TRAY_VACIO };
      expect(confirmarRecorrido(solo)).toBe(solo);
    });

    it("goes back to the draft when a confirmed route changes", () => {
      const ok = { ...confirmarRecorrido(base()), pts: base().pts };
      const editado = editarRecorrido(ok);
      expect(editado.confirmado).toBe(false);
      const movido = moverPunto(ok, "destino", [5, 5]);
      expect(movido.confirmado).toBe(false);
      expect(movido.recorrido[1]?.punto).toEqual([5, 5]);
      expect(movido.recorrido[1]?.texto).toBe(textoDesdeCoords([5, 5]));
    });

    it("inserts stops at the middle of each segment", () => {
      const t = agregarPunto(base()); // A, empty, B
      expect(tramosRecorrido(t)).toEqual([
        { indice: 2, desde: [0, 0], hasta: [9, 9], medio: [4.5, 4.5] },
      ]);
      const u = insertarParada(t, 2, {
        id: "medio",
        texto: "",
        punto: [4.5, 4.5],
      });
      expect(ids(u)).toEqual([
        "origen",
        t.recorrido[1]!.id,
        "medio",
        "destino",
      ]);
      expect(tramosRecorrido(u).map((x) => x.indice)).toEqual([2, 3]);
    });

    it("undoes and redoes map edits, including drags", () => {
      const t = base();
      const arrastrado = moverPunto(
        marcarHistorialRecorrido(t),
        "destino",
        [7, 7]
      );
      const atras = deshacerRecorrido(arrastrado);
      expect(atras.recorrido[1]?.punto).toEqual([9, 9]);
      const adelante = rehacerRecorrido(atras);
      expect(adelante.recorrido[1]?.punto).toEqual([7, 7]);
      expect(rehacerRecorrido(adelante)).toBe(adelante);
    });

    it("clears every point and can bring them back", () => {
      const t = base();
      const vacio = borrarRecorrido(t);
      expect(puntosUbicados(vacio)).toEqual([]);
      expect(borrarRecorrido(vacio)).toBe(vacio);
      expect(puntosUbicados(deshacerRecorrido(vacio))).toHaveLength(2);
    });

    it("does not record every keystroke in the history", () => {
      let t = { ...TRAY_VACIO };
      t = textoPunto(t, "origen", "a");
      t = textoPunto(t, "origen", "ab");
      expect(t.pasado).toHaveLength(0);
    });
  });

  describe("hovering the draft line", () => {
    const tramos = [
      {
        indice: 1,
        a: [0, 0] as [number, number],
        b: [100, 0] as [number, number],
      },
      {
        indice: 2,
        a: [100, 0] as [number, number],
        b: [100, 100] as [number, number],
      },
    ];

    it("follows the cursor along the nearest segment", () => {
      expect(puntoSobreLinea([37, 5], tramos)).toEqual({
        indice: 1,
        punto: [37, 0],
      });
      expect(puntoSobreLinea([96, 70], tramos)).toEqual({
        indice: 2,
        punto: [100, 70],
      });
    });

    it("ignores the cursor far from the line or on an existing point", () => {
      expect(puntoSobreLinea([50, 40], tramos)).toBeNull();
      expect(puntoSobreLinea([5, 2], tramos)).toBeNull();
      expect(puntoSobreLinea([98, 3], tramos)).toBeNull();
    });
  });

  describe("point types", () => {
    it("treats a point as a stop unless set as a deviation", () => {
      const t = agregarPunto(base());
      const medio = t.recorrido[1]!;
      expect(tipoDe(medio)).toBe("parada");
      const u = cambiarTipoPunto(t, medio.id, "desvio");
      expect(tipoDe(u.recorrido[1]!)).toBe("desvio");
    });

    it("keeps a confirmed route when only the type changes", () => {
      const t = {
        ...confirmarRecorrido(base()),
        pts: [
          [0, 0],
          [9, 9],
        ] as [number, number][],
        ajustado: true,
      };
      const u = cambiarTipoPunto(t, "destino", "desvio");
      expect(u.confirmado).toBe(true);
      expect(u.ajustado).toBe(true);
      expect(u.pts).toBe(t.pts);
      expect(u.pasado).toBe(t.pasado);
    });

    it("sends deviations to Mapbox as pass-through points", () => {
      // A, stop, deviation, deviation, B → only A, the stop and B are legs
      expect(
        waypointsDirections(["parada", "parada", "desvio", "desvio", "parada"])
      ).toBe("0;1;4");
      // all stops: no parameter needed
      expect(waypointsDirections(["parada", "parada", "parada"])).toBeNull();
      // A and B always count, whatever their stored type
      expect(waypointsDirections(["desvio", "desvio"])).toBeNull();
    });

    it("rebuilds saved types in waypoint order", () => {
      const filas = recorridoDesdePts(
        [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        ["parada", "desvio", "parada"]
      );
      expect(filas.map(tipoDe)).toEqual(["parada", "desvio", "parada"]);
      expect(tiposUbicados({ ...TRAY_VACIO, recorrido: filas })).toEqual([
        "parada",
        "desvio",
        "parada",
      ]);
    });
  });

  describe("route length", () => {
    it("adds up every segment of the path", () => {
      // ~111 km per degree of latitude
      const km =
        longitudM([
          [0, 0],
          [1, 0],
          [2, 0],
        ]) / 1000;
      expect(km).toBeGreaterThan(222);
      expect(km).toBeLessThan(223);
      expect(longitudM([[0, 0]])).toBe(0);
    });

    it("reads in meters or kilometers", () => {
      expect(textoDistancia(850.4)).toBe("850 m");
      expect(textoDistancia(12_400)).toBe("12,4 km");
    });
  });

  describe("intermediate point category", () => {
    it("sets or clears it without touching the route", () => {
      const t = {
        ...confirmarRecorrido(agregarPunto(base())),
        pts: [
          [0, 0],
          [9, 9],
        ] as [number, number][],
        ajustado: true,
      };
      const medio = t.recorrido[1]!.id;
      const con = cambiarCategoriaPunto(t, medio, "carga");
      expect(con.recorrido[1]?.categoria).toBe("carga");
      expect(con.confirmado).toBe(true);
      expect(con.pts).toBe(t.pts);
      const sin = cambiarCategoriaPunto(con, medio, undefined);
      expect(sin.recorrido[1]).not.toHaveProperty("categoria");
    });

    it("keeps categories in waypoint order and rebuilds them", () => {
      let t = base();
      t = cambiarCategoriaPunto(t, "destino", "descarga");
      expect(categoriasUbicadas(t)).toEqual([null, "descarga"]);
      const filas = recorridoDesdePts(
        [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        [],
        [null, "carga", null]
      );
      expect(filas[1]?.categoria).toBe("carga");
      expect(filas[0]).not.toHaveProperty("categoria");
    });
  });
});

it("adds unique waypoint IDs after restoring IDs from a previous page load", async () => {
  vi.resetModules();
  const fresh = await import("./recorrido");
  const restored: FormTrayecto = {
    ...TRAY_VACIO,
    recorrido: [
      { id: "punto-1", texto: "Demo stop", punto: [1, 1] },
      { id: "destino", texto: "Demo end", punto: [2, 2] },
    ],
  };
  const next = fresh.agregarPunto(restored);
  expect(new Set(next.recorrido.map((point) => point.id)).size).toBe(
    next.recorrido.length
  );
});
