import { describe, expect, it } from "vitest";
import {
  CATEGORIAS_KEY,
  CATEGORIAS_LISTA_KEY,
  COLOR_KEY,
  ICON_KEY,
  PARENT_KEY,
  type Lugar,
  type Trayecto,
} from "../places.types";
import {
  guardadosDesdePlaces,
  placeRequestSchema,
  placeViewSchema,
  requestDesdeGeocerca,
  requestDesdeLugar,
  requestDesdeTrayecto,
  type PlaceRequest,
} from "./saved-places";

const lugar = (over: Partial<Lugar> = {}): Lugar => ({
  place_id: "",
  name: " Planta ",
  address: "Ruta 5",
  category: null,
  category_id: null,
  geometry_type: "polygon",
  color: null,
  center: [-33, -70],
  polygon: [
    [-33, -70],
    [-32, -70],
    [-32, -69],
  ],
  radius_m: null,
  metadata: {
    turno: "A",
    [ICON_KEY]: "hi2-building",
    [COLOR_KEY]: "#3b82f6",
    [CATEGORIAS_KEY]: JSON.stringify(["planta"]),
    [CATEGORIAS_LISTA_KEY]: "categorias_lugar",
  },
  external_id: "SCL",
  active_from: "2026-11-01",
  active_until: "2026-12-31",
  ...over,
});

const trayecto: Trayecto = {
  trayecto_id: "",
  name: "Ruta 68",
  kind: "vial",
  width_m: 30,
  points: [
    [-33, -70],
    [-33.1, -70.5],
    [-33, -71],
  ],
  waypoints: [
    [-33, -70],
    [-33, -71],
  ],
  parent_name: null,
  ajustado: true,
  external_id: null,
  icon: "ruta",
  categorias: ["norte"],
  categorias_lista: "categorias_trayecto",
  tipos_puntos: ["parada"],
  categorias_puntos: [null],
  categorias_puntos_lista: "categorias_punto",
};

/** What miot-places answers after saving `body` with `id`. */
const vista = (id: string, body: PlaceRequest) =>
  placeViewSchema.parse({
    ...body,
    id,
    kind: body.kind,
    geofenceId: null,
    currentVersion: body.kind === "inner_geofence" ? null : "1.0.0",
    createdAt: "2026-11-02T12:00:00Z",
    createdBy: "ana@example.com",
  });

describe("saved places", () => {
  it("sends no categories as null, with nothing to look up", () => {
    const body = requestDesdeLugar(lugar({ metadata: null }), null);
    expect(body.categories).toBeNull();
    expect(
      requestDesdeTrayecto({ ...trayecto, categorias: [] }).categories
    ).toBeNull();
  });

  it("keeps the selectable of a route's categories and of its points", () => {
    const body = requestDesdeTrayecto(trayecto);
    expect(body.categories).toEqual({
      selectable: "categorias_trayecto",
      values: ["norte"],
    });
    expect(body.geojson.properties.categorias_puntos_selectable).toBe(
      "categorias_punto"
    );
  });

  it("sends a polygon as a closed GeoJSON ring in [lon, lat]", () => {
    const body = requestDesdeLugar(lugar(), null);
    expect(body).toMatchObject({
      kind: "geofence",
      parentId: null,
      externalCode: "SCL",
      name: "Planta",
      icon: "hi2-building",
      color: "#3b82f6",
      categories: { selectable: "categorias_lugar", values: ["planta"] },
      metadata: { turno: "A" },
      validFrom: "2026-11-01T00:00:00Z",
      validUntil: "2026-12-31T23:59:59Z",
    });
    expect(body.geojson.geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [-70, -33],
          [-70, -32],
          [-69, -32],
          [-70, -33],
        ],
      ],
    });
  });

  it("sends a circle as a point with its radius", () => {
    const body = requestDesdeLugar(
      lugar({ geometry_type: "circle", polygon: null, radius_m: 20 }),
      null
    );
    expect(body.geojson).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [-70, -33] },
      properties: { radius_m: 20 },
    });
  });

  it("sends an inner geofence with its parent", () => {
    const body = requestDesdeLugar(
      lugar({ metadata: { [PARENT_KEY]: "p-1" } }),
      "p-1"
    );
    expect(body.kind).toBe("inner_geofence");
    expect(body.parentId).toBe("p-1");
    expect(body.metadata).toEqual({});
  });

  it("reads back the place it saved", () => {
    const sent = lugar();
    const { lugares, trayectos } = guardadosDesdePlaces([
      vista("p-1", requestDesdeLugar(sent, null)),
    ]);
    expect(trayectos).toEqual([]);
    expect(lugares[0]).toMatchObject({
      place_id: "p-1",
      name: "Planta",
      geometry_type: "polygon",
      center: [-33, -70],
      polygon: sent.polygon,
      external_id: "SCL",
      icon: "hi2-building",
      metadata: {
        turno: "A",
        [ICON_KEY]: "hi2-building",
        [COLOR_KEY]: "#3b82f6",
        [CATEGORIAS_KEY]: JSON.stringify(["planta"]),
        [CATEGORIAS_LISTA_KEY]: "categorias_lugar",
      },
    });
  });

  it("reads back an inner circle under its parent", () => {
    const sent = lugar({
      geometry_type: "circle",
      polygon: null,
      radius_m: 15,
    });
    const [inner] = guardadosDesdePlaces([
      vista("i-1", requestDesdeLugar(sent, "p-1")),
    ]).lugares;
    expect(inner).toMatchObject({
      geometry_type: "circle",
      center: [-33, -70],
      radius_m: 15,
      polygon: null,
    });
    expect(inner?.metadata?.[PARENT_KEY]).toBe("p-1");
  });

  it("reads a circle the server stored as a polygon back as a circle", () => {
    const sent = requestDesdeLugar(lugar(), null);
    const [circle] = guardadosDesdePlaces([
      vista("c-1", {
        ...sent,
        geojson: {
          ...sent.geojson,
          properties: { shape: "circle", center: [-70, -33], radius_m: 25 },
        },
      }),
    ]).lugares;
    expect(circle).toMatchObject({
      geometry_type: "circle",
      center: [-33, -70],
      radius_m: 25,
      polygon: null,
    });
    expect(requestDesdeLugar(circle!, null).geojson.geometry.type).toBe(
      "Point"
    );
  });

  it("round-trips a route with its stops and its width", () => {
    const body = requestDesdeTrayecto({ ...trayecto, width_m: 45 });
    expect(body.kind).toBe("route");
    expect(body.geojson.geometry.type).toBe("LineString");
    const { lugares, trayectos } = guardadosDesdePlaces([vista("t-1", body)]);
    expect(lugares).toEqual([]);
    expect(trayectos[0]).toEqual({
      ...trayecto,
      trayecto_id: "t-1",
      width_m: 45,
      version: "1.0.0",
    });
  });

  it("sends a geofence with all its inner geofences, saved or new", () => {
    const hijo = lugar({
      place_id: "i-1",
      name: "Andén",
      metadata: { [PARENT_KEY]: "p-1" },
      geometry_type: "circle",
      polygon: null,
      radius_m: 15,
    });
    const body = requestDesdeGeocerca(lugar({ place_id: "p-1" }), [
      { lugar: hijo, id: "i-1" },
      { lugar: { ...hijo, name: "Nueva" }, id: null },
    ]);
    expect(body.kind).toBe("geofence");
    expect(body.inners).toHaveLength(2);
    expect(body.inners?.[0]).toMatchObject({
      kind: "inner_geofence",
      id: "i-1",
      parentId: null,
      name: "Andén",
      metadata: {},
    });
    expect(body.inners?.[1]?.id).toBeNull();
    expect(placeRequestSchema.safeParse(body).success).toBe(true);
  });

  it("keeps every metadata value when one of them is nested", () => {
    const body = requestDesdeLugar(lugar({ metadata: null }), null);
    const [leido] = guardadosDesdePlaces([
      placeViewSchema.parse({
        ...vista("p-1", body),
        metadata: { turno: "B", piso: 2, details: { zone: "A" } },
      }),
    ]).lugares;
    expect(leido?.metadata).toMatchObject({
      turno: "B",
      piso: "2",
      details: '{"zone":"A"}',
    });
  });

  it("reads the server's version of a geofence; an inner one has none", () => {
    const [padre, hijo] = guardadosDesdePlaces([
      vista("p-1", requestDesdeLugar(lugar(), null)),
      vista("i-1", requestDesdeLugar(lugar(), "p-1")),
    ]).lugares;
    expect(padre?.version).toBe("1.0.0");
    expect(hijo?.version).toBeNull();
  });
});
