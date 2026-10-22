import { describe, expect, it } from "vitest";
import {
  RADIO_MAX,
  RADIO_MIN,
  anguloDesde,
  aplicarFormaBase,
  aplicarGeomKind,
  distanciaM,
  geomKindDe,
  puntoBorde,
  radioDesdeBorde,
  rectanguloDesdeCentro,
  trianguloDesdeCentro,
} from "./geofence-editor";
import { FORM_VACIO } from "../places.types";
import { centroide } from "../map/map-handles";
import { guiasPoligono } from "./polygon-editor";

describe("geofence-editor geometry", () => {
  const santiago: [number, number] = [-33.45, -70.66];

  it("places the radius handle at the given distance from the centre", () => {
    const borde = puntoBorde(santiago, 500);
    expect(distanciaM(santiago, borde)).toBeCloseTo(500, -1);
  });

  it("reads the radius back from the handle position, rounded to 1 m", () => {
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 734))).toBe(734);
  });

  it("clamps the radius to the slider range", () => {
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 0.2))).toBe(
      RADIO_MIN
    );
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 2_000_000))).toBe(
      RADIO_MAX
    );
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 5), 10, 80)).toBe(10);
  });

  it("keeps the radius handle at the angle it was dragged to", () => {
    const norte = puntoBorde(santiago, 400, Math.PI / 2);
    expect(norte[1]).toBeCloseTo(santiago[1], 10);
    expect(norte[0]).toBeGreaterThan(santiago[0]);
    expect(anguloDesde(santiago, norte)).toBeCloseTo(Math.PI / 2, 6);
    expect(radioDesdeBorde(santiago, norte)).toBe(400);
  });

  it("builds a rectangle from a centre, width and height", () => {
    const vs = rectanguloDesdeCentro(santiago, 200, 100);
    expect(vs).toHaveLength(4);
    const [nw, ne, se, sw] = vs;
    expect(nw && ne && se && sw).toBeTruthy();
    expect(distanciaM(nw!, ne!)).toBeCloseTo(200, 0);
    expect(distanciaM(nw!, sw!)).toBeCloseTo(100, 0);
    expect(distanciaM(ne!, se!)).toBeCloseTo(100, 0);
  });

  it("maps circle, free polygon, square and triangle", () => {
    expect(geomKindDe(FORM_VACIO)).toBe("circle");
    const poly = aplicarGeomKind(FORM_VACIO, "polygon");
    expect(geomKindDe(poly)).toBe("polygon");
    expect(poly.polyBase).toBe("libre");
    const square = aplicarGeomKind(poly, "square");
    expect(geomKindDe(square)).toBe("square");
    expect(square.polyBase).toBe("rect");
    expect(square.rectVinculado).toBe(true);
    const unlinked = { ...square, rectVinculado: false, rect_h_m: 80 };
    expect(geomKindDe(unlinked)).toBe("square");
    const tri = aplicarGeomKind(square, "tri");
    expect(geomKindDe(tri)).toBe("tri");
    expect(tri.polyBase).toBe("tri");
    expect(aplicarGeomKind(square, "square")).toBe(square);
  });

  it("keeps rectangle vertices when switching to free polygon", () => {
    const square = aplicarGeomKind(
      { ...FORM_VACIO, lat: santiago[0], lon: santiago[1] },
      "square"
    );
    expect(square.vertices).toHaveLength(4);
    const poly = aplicarGeomKind(square, "polygon");
    expect(geomKindDe(poly)).toBe("polygon");
    expect(poly.polyBase).toBe("libre");
    expect(poly.vertices).toEqual(square.vertices);
    expect(poly.cerrado).toBe(true);
  });

  it("builds a triangle from a centre, width and height", () => {
    const vs = trianguloDesdeCentro(santiago, 200, 100);
    expect(vs).toHaveLength(3);
    const [cima, se, sw] = vs;
    expect(cima && se && sw).toBeTruthy();
    expect(cima![1]).toBeCloseTo(santiago[1], 10);
    expect(distanciaM(sw!, se!)).toBeCloseTo(200, 0);
  });

  it("applies a square when width and height are linked", () => {
    const next = aplicarFormaBase({
      ...FORM_VACIO,
      geom: "polygon",
      polyBase: "rect",
      rectVinculado: true,
      lat: santiago[0],
      lon: santiago[1],
      rect_w_m: 80,
      rect_h_m: 40,
    });
    expect(next.cerrado).toBe(true);
    expect(next.rect_h_m).toBe(80);
    expect(next.vertices).toHaveLength(4);
    const [nw, ne, , sw] = next.vertices;
    expect(nw && ne && sw).toBeTruthy();
    expect(distanciaM(nw!, ne!)).toBeCloseTo(80, 0);
    expect(distanciaM(nw!, sw!)).toBeCloseTo(80, 0);
  });

  it("computes the centroid used by the polygon move handle", () => {
    expect(
      centroide([
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0],
      ])
    ).toEqual([1, 1]);
  });

  it("draws a guide from the last vertex to the cursor", () => {
    const fc = guiasPoligono([[0, 0]], [1, 2]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]?.geometry).toEqual({
      type: "LineString",
      coordinates: [
        [0, 0],
        [2, 1],
      ],
    });
  });

  it("adds the closing guide back to the first vertex from 2 vertices", () => {
    const fc = guiasPoligono(
      [
        [0, 0],
        [0, 1],
      ],
      [1, 1]
    );
    expect(fc.features.map((f) => f.properties?.cierre)).toEqual([false, true]);
  });

  it("draws nothing without a cursor", () => {
    expect(guiasPoligono([[0, 0]], null).features).toHaveLength(0);
  });
});
