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
  codigoSugerido,
  conCodigoPadre,
  actualizarInner,
  INNER_COLOR_DEF,
  innerDesdeLugar,
  innersDelLugar,
  lugarHijoDesdeInner,
  innersDesdeMetadata,
  mensajeInnerIncompleto,
  faltantesPadre,
  mensajePadreIncompleto,
  nuevoInner,
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

  it("starts a new inner geofence at half its geofence's size", () => {
    // the default 20 m geofence: a 10 m circle, a 20 m square
    const circulo = { ...FORM_VACIO, lat: 0, lon: 0 };
    expect(nuevoInner(circulo)).toMatchObject({
      radius_m: 10,
      rect_w_m: 20,
      rect_h_m: 20,
    });
    // synthetic polygon at the origin, about 200 m wide and 100 m tall
    const poligono = {
      ...FORM_VACIO,
      geom: "polygon" as const,
      vertices: [
        [0, 0],
        [0, 0.0018],
        [0.0009, 0.0018],
        [0.0009, 0],
      ] as [number, number][],
    };
    const inner = nuevoInner(poligono);
    expect(inner.radius_m).toBe(25);
    expect(inner.rect_w_m).toBeCloseTo(100, -1);
    expect(inner.rect_h_m).toBeCloseTo(50, -1);
    // without the geofence's shape, the fixed sizes
    expect(nuevoInner(FORM_VACIO).radius_m).toBe(40);
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

describe("inner geofence External ID", () => {
  it("proposes the geofence's code with the next free number", () => {
    expect(codigoSugerido("SCL", [])).toBe("SCL-1");
    expect(
      codigoSugerido("SCL", [
        { external_id: "scl-1" },
        { external_id: "SCL-3" },
        { external_id: "OTRO-9" },
        { external_id: "SCL-A" },
      ])
    ).toBe("SCL-4");
  });

  it("proposes nothing without the geofence's code", () => {
    expect(codigoSugerido("  ", [{ external_id: "X-1" }])).toBe("");
  });
});

describe("inner geofences follow their geofence's External ID", () => {
  const form = {
    ...FORM_VACIO,
    external_id: "SCL",
    inners: [
      { id: "a", external_id: "SCL-1" },
      { id: "b", external_id: "scl-2" },
      { id: "c", external_id: "SCL-ANDEN" },
      { id: "d", external_id: "OTRO-3" },
    ],
  } as unknown as typeof FORM_VACIO;

  it("renames the proposed ones and leaves the ones written by hand", () => {
    const next = conCodigoPadre(form, "PLT");
    expect(next.external_id).toBe("PLT");
    expect(next.inners.map((i) => i.external_id)).toEqual([
      "PLT-1",
      "PLT-2",
      "SCL-ANDEN",
      "OTRO-3",
    ]);
  });

  it("empties the proposed ones when the geofence's code is cleared", () => {
    const next = conCodigoPadre(form, "");
    expect(next.inners.map((i) => i.external_id)).toEqual([
      "",
      "",
      "SCL-ANDEN",
      "OTRO-3",
    ]);
  });
});
