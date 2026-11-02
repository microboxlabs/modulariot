import { describe, expect, it } from "vitest";
import { errorLugar } from "./place-validation";
import { nuevoInner } from "./inner-geofences";
import { FORM_VACIO, type FormLugar, type LatLon } from "../places.types";

const tri: LatLon[] = [
  [0, 0],
  [0, 1],
  [1, 1],
];
const circulo: FormLugar = {
  ...FORM_VACIO,
  name: "Planta",
  lat: -33,
  lon: -70,
};
const poligono: FormLugar = {
  ...FORM_VACIO,
  name: "Planta",
  geom: "polygon",
  vertices: tri,
  cerrado: true,
};

describe("place validation", () => {
  it("lets a complete place be saved", () => {
    expect(errorLugar(circulo)).toBeNull();
    expect(errorLugar(poligono)).toBeNull();
  });

  it("asks for the name and the location first", () => {
    expect(errorLugar({ ...circulo, name: " " })).toBe("Falta el nombre.");
    expect(errorLugar({ ...circulo, lat: null })).toMatch(/centro/);
  });

  it("rejects a radius or size out of range", () => {
    expect(errorLugar({ ...circulo, radius_m: 0 })).toMatch(/radio/);
    expect(errorLugar({ ...circulo, radius_m: Number.NaN })).toMatch(/radio/);
    const rect: FormLugar = {
      ...poligono,
      polyBase: "rect",
      lat: -33,
      lon: -70,
      rect_w_m: 0,
    };
    expect(errorLugar(rect)).toMatch(/ancho y el alto/);
  });

  it("does not save a polygon that was never closed", () => {
    expect(errorLugar({ ...poligono, cerrado: false })).toMatch(
      /Cierra el polígono/
    );
  });

  it("rejects a validity that ends before it starts", () => {
    expect(
      errorLugar({
        ...circulo,
        active_from: "2026-10-20",
        active_until: "2026-10-01",
      })
    ).toMatch(/Desde/);
    expect(errorLugar({ ...circulo, active_from: "nope" })).toMatch(/fechas/);
    expect(
      errorLugar({ ...circulo, active_from: "2026-10-01", active_until: "" })
    ).toBeNull();
  });

  it("checks the inner geofences too", () => {
    const inner = { ...nuevoInner(), name: "Lote", lat: -33, lon: -70 };
    expect(errorLugar({ ...circulo, inners: [inner] })).toBeNull();
    expect(
      errorLugar({ ...circulo, inners: [{ ...inner, name: "" }] })
    ).toMatch(/nombre/);
    const abierto = {
      ...inner,
      geom: "polygon" as const,
      vertices: tri,
      cerrado: false,
    };
    expect(errorLugar({ ...circulo, inners: [abierto] })).toMatch(/Lote/);
  });
});
