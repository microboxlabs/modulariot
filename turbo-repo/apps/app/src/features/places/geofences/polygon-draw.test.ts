import { describe, expect, it } from "vitest";
import { FORM_VACIO, type FormLugar, type LatLon } from "../places.types";
import {
  agregarVertice,
  anilloGeoJSON,
  cancelarDibujo,
  geometriaDibujo,
  deshacer,
  eliminarVertice,
  extremoOpuesto,
  insertarVertice,
  lados,
  marcarHistorial,
  moverVertice,
  puedeEliminar,
  puedeTerminar,
  rehacer,
  seguirDibujando,
  terminar,
  unirExtremos,
} from "./polygon-draw";

const poly = (vertices: LatLon[], cerrado = false): FormLugar => ({
  ...FORM_VACIO,
  geom: "polygon",
  vertices,
  cerrado,
  lat: vertices[0]?.[0] ?? null,
  lon: vertices[0]?.[1] ?? null,
});
const tri: LatLon[] = [
  [0, 0],
  [0, 1],
  [1, 1],
];

describe("polygon-draw", () => {
  it("joins the last vertex dropped on the first and closes the shape", () => {
    // four points, the last one dragged onto the first: they become one
    const abierto = poly([...tri, [0, 0.0001]]);
    const f = unirExtremos(abierto, 3, [1, 0]);
    expect(f.cerrado).toBe(true);
    expect(f.vertices).toEqual(tri);
  });

  it("also joins the first vertex dropped on the last", () => {
    const abierto = poly([[1, 0.0001], ...tri.slice(1), [1, 0]]);
    const f = unirExtremos(abierto, 0, [0, 0]);
    expect(f.cerrado).toBe(true);
    expect(f.vertices).toEqual([...tri.slice(1), [1, 0]]);
  });

  it("with only three points, puts the dragged one back and closes", () => {
    // merging would leave two points: the drop just closes the triangle
    const abierto = poly([tri[0]!, tri[1]!, [0, 0.0001]]);
    const f = unirExtremos(abierto, 2, [1, 1]);
    expect(f.cerrado).toBe(true);
    expect(f.vertices).toEqual(tri);
  });

  it("only joins the ends of an open shape", () => {
    expect(unirExtremos(poly(tri), 1, [0, 1])).toEqual(poly(tri));
    expect(unirExtremos(poly(tri, true), 2, [1, 1])).toEqual(poly(tri, true));
    expect(extremoOpuesto(poly(tri), 0)).toBe(2);
    expect(extremoOpuesto(poly(tri), 2)).toBe(0);
    expect(extremoOpuesto(poly(tri), 1)).toBeNull();
    expect(extremoOpuesto(poly(tri, true), 0)).toBeNull();
    expect(extremoOpuesto(poly(tri.slice(0, 2)), 0)).toBeNull();
  });

  it("adds vertices and keeps the first one as the reference centre", () => {
    const f = agregarVertice(agregarVertice(poly([]), [5, 6]), [7, 8]);
    expect(f.vertices).toEqual([
      [5, 6],
      [7, 8],
    ]);
    expect([f.lat, f.lon]).toEqual([5, 6]);
  });

  it("only finishes with at least 3 vertices", () => {
    expect(puedeTerminar(poly(tri.slice(0, 2)))).toBe(false);
    expect(terminar(poly(tri.slice(0, 2))).cerrado).toBe(false);
    expect(terminar(poly(tri)).cerrado).toBe(true);
  });

  it("map clicks do not add vertices once finished", () => {
    const f = poly(tri, true);
    expect(agregarVertice(f, [9, 9])).toBe(f);
  });

  it("turns a rectangle into a free polygon when a vertex is edited", () => {
    const rect = poly(
      [
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
      true
    );
    rect.polyBase = "rect";
    const moved = moverVertice(rect, 0, [1.2, 0]);
    expect(moved.polyBase).toBe("libre");
    expect(moved.vertices[0]).toEqual([1.2, 0]);
    const extra = insertarVertice(rect, 1, [1, 0.5]);
    expect(extra.polyBase).toBe("libre");
    expect(extra.vertices).toHaveLength(5);
  });

  it("inserts a vertex in the middle of a side", () => {
    const f = insertarVertice(poly(tri, true), 1, [0, 0.5]);
    expect(f.vertices).toEqual([
      [0, 0],
      [0, 0.5],
      [0, 1],
      [1, 1],
    ]);
  });

  it("lists sides, including the closing one only when finished", () => {
    expect(lados(poly(tri))).toEqual([
      [0, 1],
      [1, 2],
    ]);
    expect(lados(poly(tri, true))).toEqual([
      [0, 1],
      [1, 2],
      [2, 0],
    ]);
    expect(lados(poly([[0, 0]]))).toEqual([]);
  });

  it("deletes vertices; a finished polygon keeps the minimum", () => {
    const four = poly([...tri, [1, 0]], true);
    const f = eliminarVertice(four, 0);
    expect(f.vertices).toEqual([
      [0, 1],
      [1, 1],
      [1, 0],
    ]);
    expect([f.lat, f.lon]).toEqual([0, 1]);
    expect(puedeEliminar(f)).toBe(false);
    expect(eliminarVertice(f, 0)).toBe(f);
    // while drawing any vertex can go
    expect(eliminarVertice(poly(tri), 1).vertices).toHaveLength(2);
  });

  it("undoes and redoes every kind of edit", () => {
    let f = agregarVertice(poly([]), [0, 0]);
    f = agregarVertice(f, [0, 1]);
    f = insertarVertice(f, 1, [0, 0.5]);
    f = eliminarVertice(f, 0);
    expect(f.vertices).toEqual([
      [0, 0.5],
      [0, 1],
    ]);

    f = deshacer(f);
    expect(f.vertices).toEqual([
      [0, 0],
      [0, 0.5],
      [0, 1],
    ]);
    f = deshacer(f);
    expect(f.vertices).toEqual([
      [0, 0],
      [0, 1],
    ]);
    f = rehacer(f);
    expect(f.vertices).toEqual([
      [0, 0],
      [0, 0.5],
      [0, 1],
    ]);
  });

  it("a drag is one undo step", () => {
    let f = marcarHistorial(poly(tri, true));
    f = moverVertice(f, 0, [5, 5]);
    f = moverVertice(f, 0, [6, 6]);
    expect(f.vertices[0]).toEqual([6, 6]);
    expect(deshacer(f).vertices).toEqual(tri);
  });

  it("a new edit clears redo", () => {
    const undone = deshacer(agregarVertice(poly(tri.slice(0, 2)), [1, 1]));
    expect(undone.futuro).toHaveLength(1);
    const f = agregarVertice(undone, [5, 5]);
    expect(f.futuro).toEqual([]);
    expect(rehacer(f)).toBe(f);
  });

  it("cancel can be undone", () => {
    const f = cancelarDibujo(agregarVertice(poly(tri.slice(0, 2)), [1, 1]));
    expect(f.vertices).toEqual([]);
    expect(deshacer(f).vertices).toEqual(tri);
  });

  it("undoing below the minimum reopens a finished polygon", () => {
    const f = terminar(agregarVertice(poly(tri.slice(0, 2)), [1, 1]));
    expect(f.cerrado).toBe(true);
    expect(deshacer(f).cerrado).toBe(false);
  });

  it("can reopen a finished polygon", () => {
    expect(seguirDibujando(poly(tri, true)).cerrado).toBe(false);
  });

  it("builds a closed GeoJSON ring so the last side is drawn", () => {
    expect(anilloGeoJSON(tri)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ]);
    // already closed rings are left as they are
    expect(anilloGeoJSON([...tri, [0, 0]])).toHaveLength(4);
    expect(anilloGeoJSON([])).toEqual([]);
  });

  it("keeps the drawing open until it is closed", () => {
    expect(geometriaDibujo(tri, false)).toEqual({
      type: "LineString",
      coordinates: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    });
    expect(geometriaDibujo(tri, true)?.type).toBe("Polygon");
    expect(geometriaDibujo([[0, 0]], false)).toBeNull();
  });
});
