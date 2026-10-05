import { describe, expect, it } from "vitest";
import {
  RADIO_MAX,
  RADIO_MIN,
  anguloDesde,
  distanciaM,
  puntoBorde,
  radioDesdeBorde,
} from "./geofence-editor";
import { centroide } from "./map-handles";
import { guiasPoligono } from "./polygon-editor";

describe("geofence-editor geometry", () => {
  const santiago: [number, number] = [-33.45, -70.66];

  it("places the radius handle at the given distance from the centre", () => {
    const borde = puntoBorde(santiago, 500);
    expect(distanciaM(santiago, borde)).toBeCloseTo(500, -1);
  });

  it("reads the radius back from the handle position, rounded to 10 m", () => {
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 734))).toBe(730);
  });

  it("clamps the radius to the slider range", () => {
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 5))).toBe(RADIO_MIN);
    expect(radioDesdeBorde(santiago, puntoBorde(santiago, 90_000))).toBe(
      RADIO_MAX
    );
  });

  it("keeps the radius handle at the angle it was dragged to", () => {
    const norte = puntoBorde(santiago, 400, Math.PI / 2);
    expect(norte[1]).toBeCloseTo(santiago[1], 10);
    expect(norte[0]).toBeGreaterThan(santiago[0]);
    expect(anguloDesde(santiago, norte)).toBeCloseTo(Math.PI / 2, 6);
    expect(radioDesdeBorde(santiago, norte)).toBe(400);
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
