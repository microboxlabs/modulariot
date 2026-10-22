import { describe, expect, it } from "vitest";
import {
  FORM_VACIO,
  TRAY_VACIO,
  type FormLugar,
  type FormTrayecto,
  type InnerGeofence,
} from "../places.types";
import {
  bumpRecomendado,
  cambiosLugar,
  cambiosTrayecto,
  nextVersion,
} from "./versioning";

const lugar: FormLugar = {
  ...FORM_VACIO,
  place_id: "p1",
  name: "Planta Norte",
  lat: -33,
  lon: -70,
  radius_m: 200,
  categorias: ["bodega"],
};

const inner: InnerGeofence = {
  id: "i1",
  name: "Lote VIP",
  geom: "circle",
  lat: -33,
  lon: -70,
  radius_m: 20,
  vertices: [],
  cerrado: false,
  color: "#1C64F2",
};

const tray: FormTrayecto = {
  ...TRAY_VACIO,
  id: "t1",
  name: "Ruta 5",
  recorrido: [
    { id: "origen", texto: "A", punto: [-33, -70] },
    { id: "m1", texto: "M", punto: [-33.5, -70.5] },
    { id: "destino", texto: "B", punto: [-34, -71] },
  ],
};

describe("places versioning", () => {
  it("finds nothing when the form did not change", () => {
    expect(cambiosLugar(lugar, { ...lugar })).toEqual([]);
    expect(cambiosTrayecto(tray, { ...tray })).toEqual([]);
  });

  it("sizes geofence changes: shape major, categories minor, name patch", () => {
    const cambios = cambiosLugar(lugar, {
      ...lugar,
      name: "Planta Norte 2",
      radius_m: 300,
      categorias: ["bodega", "taller"],
    });
    expect(cambios).toEqual([
      { texto: "Radio de la geocerca: 200 m → 300 m", bump: "MAJOR" },
      { texto: "Categorías: 1 agregada", bump: "MINOR" },
      {
        texto: "Nombre: «Planta Norte» → «Planta Norte 2»",
        bump: "PATCH",
      },
    ]);
    expect(bumpRecomendado(cambios)).toBe("MAJOR");
  });

  it("recommends only as big as the biggest change", () => {
    const soloNombre = cambiosLugar(lugar, { ...lugar, name: "Otra" });
    expect(bumpRecomendado(soloNombre)).toBe("PATCH");
    const vigencia = cambiosLugar(lugar, {
      ...lugar,
      name: "Otra",
      active_until: "2026-12-31",
    });
    expect(bumpRecomendado(vigencia)).toBe("MINOR");
    expect(bumpRecomendado([])).toBeNull();
  });

  it("lists interior geofences added, reshaped and removed", () => {
    const antes = { ...lugar, inners: [inner] };
    expect(
      cambiosLugar(antes, {
        ...lugar,
        inners: [{ ...inner, radius_m: 30 }],
      })
    ).toEqual([
      {
        texto: "Radio de la geocerca interior «Lote VIP»: 20 m → 30 m",
        bump: "MAJOR",
      },
    ]);
    expect(cambiosLugar(antes, lugar)).toEqual([
      { texto: "Geocerca interior quitada: «Lote VIP»", bump: "MINOR" },
    ]);
    expect(cambiosLugar(lugar, antes)).toEqual([
      { texto: "Geocerca interior agregada: «Lote VIP»", bump: "MINOR" },
    ]);
  });

  it("treats a moved or redrawn polygon as a new shape", () => {
    const poly: FormLugar = {
      ...lugar,
      geom: "polygon",
      vertices: [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
    };
    expect(
      cambiosLugar(poly, {
        ...poly,
        vertices: [...poly.vertices, [1, 0]],
      })
    ).toEqual([
      { texto: "Forma de la geocerca (3 → 4 vértices)", bump: "MAJOR" },
    ]);
    expect(cambiosLugar(lugar, poly)[0]).toEqual({
      texto: "Tipo de la geocerca: círculo → polígono",
      bump: "MAJOR",
    });
  });

  it("sizes trayecto changes: route major, point kind minor, name patch", () => {
    const [a, m, b] = tray.recorrido;
    const movido = cambiosTrayecto(tray, {
      ...tray,
      recorrido: [a!, m!, { ...b!, punto: [-35, -72] }],
    });
    expect(movido).toEqual([{ texto: "Destino (B) movido", bump: "MAJOR" }]);

    const tipo = cambiosTrayecto(tray, {
      ...tray,
      name: "Ruta 5 sur",
      recorrido: [a!, { ...m!, tipo: "desvio" }, b!],
    });
    expect(tipo).toEqual([
      { texto: "Parada o desvío cambiado en 1 punto", bump: "MINOR" },
      { texto: "Nombre: «Ruta 5» → «Ruta 5 sur»", bump: "PATCH" },
    ]);

    const menos = cambiosTrayecto(tray, { ...tray, recorrido: [a!, b!] });
    expect(menos).toEqual([
      { texto: "Puntos intermedios: 1 → 0", bump: "MAJOR" },
    ]);
  });

  it("raises the version like the symptoms do", () => {
    expect(nextVersion("1.0.0", "PATCH")).toBe("1.0.1");
    expect(nextVersion("1.2.3", "MINOR")).toBe("1.3.0");
    expect(nextVersion("1.2.3", "MAJOR")).toBe("2.0.0");
  });
});
