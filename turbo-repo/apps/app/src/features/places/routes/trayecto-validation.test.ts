import { describe, expect, it } from "vitest";
import { ANCHO_MAX, errorTrayecto } from "./trayecto-validation";
import { recorridoDesdePts } from "./recorrido";
import { TRAY_VACIO, type FormTrayecto, type LatLon } from "../places.types";

const pts: LatLon[] = [
  [-33, -70],
  [-33.1, -70.1],
];
const listo: FormTrayecto = {
  ...TRAY_VACIO,
  name: "Ruta 5",
  external_id: "R-5",
  pts,
  recorrido: recorridoDesdePts(pts),
  confirmado: true,
};

describe("trayecto validation", () => {
  it("requires a list before uploading legacy category codes", () => {
    expect(
      errorTrayecto({
        ...listo,
        categorias: ["legacy"],
        categorias_lista: null,
      })
    ).toBe("Elige una lista antes de guardar las categorías existentes.");
    expect(
      errorTrayecto({
        ...listo,
        categorias: ["legacy"],
        categorias_lista: "demo-list",
      })
    ).toBeNull();
  });

  it("lets a complete route be saved", () => {
    expect(errorTrayecto(listo)).toBeNull();
  });

  it("needs the origin and destination, confirmed", () => {
    expect(
      errorTrayecto({ ...listo, recorrido: recorridoDesdePts([pts[0]!]) })
    ).toMatch(/origen/);
    expect(errorTrayecto({ ...listo, confirmado: false })).toMatch(/Listo/);
  });

  it("needs a name and a width in range", () => {
    expect(errorTrayecto({ ...listo, name: "  " })).toMatch(/nombre/);
    expect(errorTrayecto({ ...listo, external_id: "  " })).toMatch(
      /External ID/
    );
    expect(errorTrayecto({ ...listo, width_m: 0 })).toMatch(/ancho/);
    expect(errorTrayecto({ ...listo, width_m: ANCHO_MAX + 1 })).toMatch(
      /ancho/
    );
  });
});
