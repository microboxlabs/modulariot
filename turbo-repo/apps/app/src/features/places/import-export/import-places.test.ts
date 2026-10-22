import { describe, expect, it, vi } from "vitest";
import {
  esArchivoImport,
  filasCsv,
  filasDeLotes,
  filasGeoJson,
  filasKml,
  lugarDesdeFilaImport,
  parsearTextoLugares,
  poligonoDesdeBbox,
  verticesDesdeAnillo,
  type LoteImport,
} from "./import-places";
import { FORM_VACIO } from "../places.types";
import {
  EJEMPLO_CSV,
  EJEMPLO_CSV_POLIGONO,
  EJEMPLO_GEOJSON,
  EJEMPLO_KML,
} from "./import-places.fixtures";

describe("import places geometry", () => {
  it("turns a bbox into a 4-vertex polygon", () => {
    expect(poligonoDesdeBbox(-70.735, -33.362, -70.732, -33.36)).toEqual([
      [-33.362, -70.735],
      [-33.362, -70.732],
      [-33.36, -70.732],
      [-33.36, -70.735],
    ]);
  });

  it("drops the closing vertex of a GeoJSON ring", () => {
    const vs = verticesDesdeAnillo([
      [-70.735, -33.362],
      [-70.732, -33.362],
      [-70.732, -33.36],
      [-70.735, -33.36],
      [-70.735, -33.362],
    ]);
    expect(vs).toHaveLength(4);
    expect(vs[0]).toEqual([-33.362, -70.735]);
  });
});

describe("import parsers", () => {
  it("reads CSV points from the sample file", () => {
    const filas = filasCsv(EJEMPLO_CSV);
    expect(filas[0]).toMatchObject({
      name: "Planta Quilicura",
      geometry_type: "circle",
      lat: -33.3602,
      lon: -70.7315,
    });
    expect(filas).toHaveLength(4);
  });

  it("reads a CSV bounding box as a polygon", () => {
    const filas = filasCsv(EJEMPLO_CSV_POLIGONO);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.geometry_type).toBe("polygon");
    expect(filas[0]?.vertices).toHaveLength(4);
  });

  it("reads KML points and turns rectangular polygons into system polygons", () => {
    const filas = filasKml(EJEMPLO_KML);
    expect(filas.map((f) => f.name)).toEqual([
      "Tótem acceso planta",
      "Galpón rectangular",
      "Estacionamiento norte",
    ]);
    expect(filas[0]?.geometry_type).toBe("circle");
    expect(filas[1]).toMatchObject({
      name: "Galpón rectangular",
      geometry_type: "polygon",
    });
    expect(filas[1]?.vertices).toHaveLength(4);
    expect(filas[2]?.vertices).toHaveLength(4);
  });

  it("reads KML without the page's DOMParser and survives a broken file", () => {
    // the file's text never becomes DOM of the page (CodeQL: DOM as HTML)
    const nativo = vi.spyOn(globalThis.DOMParser.prototype, "parseFromString");
    expect(filasKml(EJEMPLO_KML)).toHaveLength(3);
    expect(nativo).not.toHaveBeenCalled();
    nativo.mockRestore();
    // malformed XML: no rows, no crash
    expect(filasKml("<kml><Placemark><name>sin cerrar")).toEqual([]);
    expect(filasKml("no es xml")).toEqual([]);
  });

  it("reads GeoJSON points, rectangles, unofficial squares and bbox as polygons", () => {
    const filas = filasGeoJson(EJEMPLO_GEOJSON);
    expect(filas.map((f) => f.name)).toEqual([
      "Planta Quilicura",
      "Patio rectangular",
      "Cuadrado de acopio",
      "Zona bbox",
    ]);
    expect(filas[0]?.geometry_type).toBe("circle");
    expect(filas[1]?.geometry_type).toBe("polygon");
    expect(filas[1]?.vertices).toHaveLength(4);
    expect(filas[2]?.geometry_type).toBe("polygon");
    expect(filas[2]?.vertices).toHaveLength(4);
    expect(filas[3]?.geometry_type).toBe("polygon");
    expect(filas[3]?.vertices).toHaveLength(4);
  });

  it("accepts csv, kml and geojson filenames", () => {
    expect(esArchivoImport(new File([], "a.csv"))).toBe(true);
    expect(esArchivoImport(new File([], "a.kml"))).toBe(true);
    expect(esArchivoImport(new File([], "a.geojson"))).toBe(true);
    expect(esArchivoImport(new File([], "a.png"))).toBe(false);
  });

  it("flattens lotes even when lotes or filas are missing", () => {
    expect(filasDeLotes(undefined)).toEqual([]);
    expect(
      filasDeLotes([{ filename: "a.csv", formato: "csv" } as LoteImport])
    ).toEqual([]);
    expect(
      filasDeLotes([
        {
          filename: "a.csv",
          formato: "csv",
          filas: [
            {
              name: "Planta",
              lat: -33.36,
              lon: -70.73,
              geometry_type: "circle",
            },
          ],
        },
      ]).map((f) => f.name)
    ).toEqual(["Planta"]);
  });

  it("uses the place form radius when a circle row has none", () => {
    const lugar = lugarDesdeFilaImport(
      {
        name: "Planta",
        lat: -33.36,
        lon: -70.73,
        geometry_type: "circle",
      },
      [],
      "local-1",
      null
    );
    expect(lugar.radius_m).toBe(FORM_VACIO.radius_m);
  });

  it("picks the parser from the filename", () => {
    expect(parsearTextoLugares("a.geojson", EJEMPLO_GEOJSON).formato).toBe(
      "geojson"
    );
    expect(parsearTextoLugares("a.kml", EJEMPLO_KML).filas).toHaveLength(3);
    expect(parsearTextoLugares("a.csv", EJEMPLO_CSV).formato).toBe("csv");
  });
});
