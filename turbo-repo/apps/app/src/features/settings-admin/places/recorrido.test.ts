import { describe, expect, it } from "vitest";
import { TRAY_VACIO, type FormTrayecto } from "./places.types";
import {
  MAX_PUNTOS,
  agregarPunto,
  elegirPunto,
  etiquetaPunto,
  nombreRecorrido,
  puntosRecorrido,
  quitarPunto,
  reordenar,
  textoPunto,
} from "./recorrido";

const sug = (nombre: string, punto: [number, number]) => ({
  id: nombre,
  nombre,
  contexto: "",
  punto,
});

/** A y B elegidos. */
const base = (): FormTrayecto => {
  let t: FormTrayecto = { ...TRAY_VACIO, metodo: "direccion" };
  t = elegirPunto(t, "origen", sug("A", [0, 0]));
  return elegirPunto(t, "destino", sug("B", [9, 9]));
};
const ids = (t: FormTrayecto) => t.recorrido.map((p) => p.id);

describe("recorrido", () => {
  it("starts with an empty origin and destination", () => {
    expect(TRAY_VACIO.recorrido).toHaveLength(2);
    expect(puntosRecorrido({ ...TRAY_VACIO })).toBeNull();
  });

  it("labels points by position: A, numbers, B", () => {
    expect(etiquetaPunto(0, 4).letra).toBe("A");
    expect(etiquetaPunto(1, 4).letra).toBe("1");
    expect(etiquetaPunto(2, 4).letra).toBe("2");
    expect(etiquetaPunto(3, 4).letra).toBe("B");
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
    expect(nombreRecorrido(t)).toBe("A → B");
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

  it("keeps at least two points and at most the routing limit", () => {
    const t = base();
    expect(quitarPunto(t, "origen")).toBe(t);
    let u = t;
    for (let i = 0; i < MAX_PUNTOS + 3; i++) u = agregarPunto(u);
    expect(u.recorrido).toHaveLength(MAX_PUNTOS);
    expect(quitarPunto(u, "origen").recorrido).toHaveLength(MAX_PUNTOS - 1);
  });
});
