import { describe, expect, it, vi } from "vitest";
import {
  esArchivoImport,
  MAX_IMPORT_BYTES,
  parsearArchivoLugares,
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
import JSZip from "jszip";
import { FORM_VACIO } from "../places.types";
import {
  EJEMPLO_CSV,
  EJEMPLO_CSV_POLIGONO,
  EJEMPLO_GEOJSON,
  EJEMPLO_KML,
} from "./import-places.fixtures";

describe("import places geometry", () => {
  it("bounds compressed and expanded imports before retaining oversized content", async () => {
    const tooLarge = new File(
      [new Uint8Array(MAX_IMPORT_BYTES + 1)],
      "demo.kml"
    );
    await expect(parsearArchivoLugares(tooLarge)).rejects.toThrow("8 MiB");
    const zip = new JSZip();
    zip.file("demo.kml", "x".repeat(MAX_IMPORT_BYTES + 1));
    const data = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });
    const compressed = new File([data], "demo.kmz");
    Object.defineProperty(compressed, "arrayBuffer", {
      value: async () => data.buffer,
    });
    expect(compressed.size).toBeLessThan(MAX_IMPORT_BYTES);
    await expect(parsearArchivoLugares(compressed)).rejects.toThrow("8 MiB");
  });

  it("reads a valid compressed KML through the bounded stream", async () => {
    const zip = new JSZip();
    zip.file("demo.kml", EJEMPLO_KML);
    const data = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });
    const file = new File([data], "demo.kmz");
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => data.buffer,
    });
    expect((await parsearArchivoLugares(file)).filas).toHaveLength(3);
  });
  it("reads quoted CSV names and addresses without shifting coordinates", () => {
    const rows = filasCsv(
      'name,lat,lon,address\n"Demo, Site",-33,-70,"Demo avenue, 12"'
    );
    expect(rows).toMatchObject([
      { name: "Demo, Site", lat: -33, lon: -70, address: "Demo avenue, 12" },
    ]);
  });

  it("does not invent zero coordinates for missing CSV values", () => {
    expect(
      filasCsv(
        "name,lat,lon\nMissing latitude,,-70\nMissing longitude,-33,\nValid origin,0,0"
      )
    ).toMatchObject([{ name: "Valid origin", lat: 0, lon: 0 }]);
  });

  it.each(["null", "3", '"text"', "[]"])(
    "ignores non-object GeoJSON %s",
    (input) => {
      expect(filasGeoJson(input)).toEqual([]);
    }
  );

  it("refuses out-of-range coordinates in CSV and GeoJSON", () => {
    expect(
      filasCsv("name,lat,lon\nBad latitude,91,0\nBad longitude,0,181")
    ).toEqual([]);
    expect(
      filasGeoJson(JSON.stringify({ type: "Point", coordinates: [181, 0] }))
    ).toEqual([]);
    expect(
      filasGeoJson(
        JSON.stringify({
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [181, 0],
              [0, 1],
              [0, 0],
            ],
          ],
        })
      )
    ).toEqual([]);
  });
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
