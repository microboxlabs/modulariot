import { describe, expect, it } from "vitest";
import {
  FORM_VACIO,
  COLOR_KEY,
  INNER_KEY,
  PARENT_KEY,
  metadataAFilas,
  metadataParaGuardar,
  type Lugar,
} from "../places.types";
import {
  actualizarInner,
  INNER_COLOR_DEF,
  innerDesdeLugar,
  innersDelLugar,
  lugarHijoDesdeInner,
  innersDesdeMetadata,
  mensajeInnerIncompleto,
  faltantesPadre,
  mensajePadreIncompleto,
  padreTieneGeometria,
  parentPlaceId,
  puntoDentroDelPadre,
  puntoEnPoligono,
} from "./inner-geofences";

const square: [number, number][] = [
  [0, 0],
  [0, 2],
  [2, 2],
  [2, 0],
];

describe("inner geofence geometry", () => {
  it("detects a point inside a polygon", () => {
    expect(puntoEnPoligono([1, 1], square)).toBe(true);
    expect(puntoEnPoligono([3, 3], square)).toBe(false);
  });

  it("requires the inner click to land inside the parent circle", () => {
    const form = {
      ...FORM_VACIO,
      geom: "circle" as const,
      lat: -33.45,
      lon: -70.66,
      radius_m: 200,
    };
    expect(puntoDentroDelPadre(form, [-33.45, -70.66])).toBe(true);
    expect(puntoDentroDelPadre(form, [-32, -70])).toBe(false);
    expect(padreTieneGeometria(form)).toBe(true);
    expect(padreTieneGeometria(FORM_VACIO)).toBe(false);
  });
});

describe("inner geofence persistence", () => {
  it("round-trips inners through reserved metadata and hides them from rows", () => {
    const form = {
      ...FORM_VACIO,
      inners: [
        {
          id: "local-inner-1",
          name: "Lote VIP",
          geom: "circle" as const,
          lat: -33.45,
          lon: -70.66,
          radius_m: 40,
          vertices: [],
          cerrado: false,
          color: "#E02424",
        },
      ],
    };
    const meta = metadataParaGuardar(form);
    expect(JSON.parse(meta[INNER_KEY] ?? "[]")).toHaveLength(1);
    expect(metadataAFilas(meta)).toEqual([]);
    expect(innersDesdeMetadata(meta)[0]?.name).toBe("Lote VIP");
    expect(innersDesdeMetadata(meta)[0]?.color).toBe("#E02424");
  });

  it("prefers child places over the parent metadata copy", () => {
    const parent: Lugar = {
      place_id: "park",
      name: "Estacionamiento",
      address: null,
      category: null,
      category_id: null,
      geometry_type: "circle",
      color: null,
      center: [-33, -70],
      polygon: null,
      radius_m: 250,
      metadata: {
        [INNER_KEY]: JSON.stringify([
          {
            id: "lot-1",
            name: "Viejo",
            geom: "circle",
            lat: -33,
            lon: -70,
            radius_m: 20,
            vertices: [],
            cerrado: false,
          },
        ]),
      },
      external_id: null,
      active_from: null,
      active_until: null,
    };
    const child: Lugar = {
      ...parent,
      place_id: "lot-1",
      name: "Lote VIP",
      radius_m: 40,
      metadata: { [PARENT_KEY]: "park" },
    };
    const inners = innersDelLugar(parent, [parent, child]);
    expect(inners).toHaveLength(1);
    expect(inners[0]?.name).toBe("Lote VIP");
    expect(inners[0]?.radius_m).toBe(40);
    expect(parentPlaceId(child)).toBe("park");
  });

  it("maps a saved child place back to an inner geofence", () => {
    const inner = innerDesdeLugar({
      place_id: "lot-1",
      name: "Lote",
      address: null,
      category: null,
      category_id: null,
      geometry_type: "circle",
      color: null,
      center: [-33.4, -70.6],
      polygon: null,
      radius_m: 30,
      metadata: { [PARENT_KEY]: "park", [COLOR_KEY]: "#7E3AF2" },
      external_id: null,
      active_from: null,
      active_until: null,
    });
    expect(inner).toMatchObject({
      id: "lot-1",
      geom: "circle",
      lat: -33.4,
      radius_m: 30,
      color: "#7E3AF2",
    });
  });

  it("keeps the inner color when turning it into a child place", () => {
    const parent: Lugar = {
      place_id: "park",
      name: "Estacionamiento",
      address: null,
      category: null,
      category_id: null,
      geometry_type: "circle",
      color: "#1C64F2",
      center: [-33, -70],
      polygon: null,
      radius_m: 250,
      metadata: null,
      external_id: null,
      active_from: null,
      active_until: null,
    };
    const hijo = lugarHijoDesdeInner(
      {
        id: "lot-1",
        name: "Lote",
        geom: "circle",
        lat: -33.4,
        lon: -70.6,
        radius_m: 30,
        vertices: [],
        cerrado: false,
        color: "#E02424",
      },
      parent
    );
    expect(hijo.color).toBe("#E02424");
    expect(hijo.metadata?.[COLOR_KEY]).toBe("#E02424");
  });

  it("asks for a parent name and shape before the inner step", () => {
    expect(mensajePadreIncompleto(FORM_VACIO)).toBe("Falta el nombre.");
    expect(faltantesPadre(FORM_VACIO)).toEqual({
      name: true,
      ubicacion: true,
      geometria: false,
    });
    expect(mensajePadreIncompleto({ ...FORM_VACIO, name: "Planta" })).toMatch(
      /centro/
    );
  });

  it("asks for a name and a shape before saving a started inner", () => {
    expect(
      mensajeInnerIncompleto({
        id: "x",
        name: "",
        geom: "circle",
        lat: null,
        lon: null,
        radius_m: 40,
        vertices: [],
        cerrado: false,
        color: INNER_COLOR_DEF,
      })
    ).toBeNull();
    expect(
      mensajeInnerIncompleto({
        id: "x",
        name: "VIP",
        geom: "circle",
        lat: null,
        lon: null,
        radius_m: 40,
        vertices: [],
        cerrado: false,
        color: INNER_COLOR_DEF,
      })
    ).toMatch(/VIP/);
  });

  it("patches a single inner from a form updater", () => {
    const form = {
      ...FORM_VACIO,
      inners: [
        {
          id: "a",
          name: "VIP",
          geom: "circle" as const,
          lat: null,
          lon: null,
          radius_m: 40,
          vertices: [],
          cerrado: false,
          color: "#E02424",
        },
      ],
      innerEditId: "a",
    };
    const next = actualizarInner(form, "a", (f) => ({
      ...f,
      lat: 1,
      lon: 2,
    }));
    expect(next.inners[0]).toMatchObject({ lat: 1, lon: 2, name: "VIP" });
  });
});
