import { describe, expect, it } from "vitest";
import { cambioLugar, cambioTrayecto } from "./form-changes";
import { recorridoDesdePts } from "../routes/recorrido";
import { FORM_VACIO, TRAY_VACIO } from "../places.types";

describe("form changes", () => {
  const lugar = { ...FORM_VACIO, name: "Planta", lat: -33, lon: -70 };

  it("sees a change in what gets saved", () => {
    expect(cambioLugar(lugar, { ...lugar })).toBe(false);
    expect(cambioLugar(lugar, { ...lugar, name: "Otra" })).toBe(true);
    expect(cambioLugar(lugar, { ...lugar, radius_m: 40 })).toBe(true);
  });

  it("ignores interface-only state", () => {
    expect(
      cambioLugar(lugar, {
        ...lugar,
        busqueda: "araucano",
        ubicadoEn: "Parque Araucano",
        innerEditId: "x",
        pasado: [[[0, 0]]],
      })
    ).toBe(false);
  });

  it("ignores the automatic label of a placed route point", () => {
    const tray = { ...TRAY_VACIO, recorrido: recorridoDesdePts([[-33, -70]]) };
    const rotulado = {
      ...tray,
      recorrido: tray.recorrido.map((p) =>
        p.id === "origen" ? { ...p, texto: "Av. Apoquindo 123" } : p
      ),
    };
    expect(cambioTrayecto(tray, rotulado)).toBe(false);
    // a text typed on a point not placed yet does count
    const escrito = {
      ...tray,
      recorrido: tray.recorrido.map((p) =>
        p.id === "destino" ? { ...p, texto: "Rancagua" } : p
      ),
    };
    expect(cambioTrayecto(tray, escrito)).toBe(true);
    expect(cambioTrayecto(tray, { ...tray, name: "Ruta" })).toBe(true);
  });
});
