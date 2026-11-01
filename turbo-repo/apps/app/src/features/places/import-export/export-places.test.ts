import { describe, expect, it } from "vitest";
import {
  contenidoExport,
  exportarCsv,
  formatosPara,
  nombreArchivoExport,
} from "./export-places";
import { filasCsv, filasGeoJson, filasKml } from "./import-places";
import type { Lugar, Trayecto } from "../places.types";

const base: Lugar = {
  place_id: "p",
  name: "Planta",
  address: null,
  category: null,
  category_id: null,
  geometry_type: "circle",
  color: null,
  center: [-33.4, -70.6],
  polygon: null,
  radius_m: 50,
  metadata: null,
  external_id: "EXT-1",
  active_from: null,
  active_until: null,
};
const poligono: Lugar = {
  ...base,
  place_id: "q",
  name: "Bodega",
  geometry_type: "polygon",
  polygon: [
    [-33.41, -70.61],
    [-33.42, -70.61],
    [-33.42, -70.62],
  ],
  radius_m: null,
  external_id: null,
};
const trayecto: Trayecto = {
  trayecto_id: "t",
  name: "Acceso norte",
  kind: "vial",
  width_m: 30,
  points: [
    [-33.4, -70.6],
    [-33.41, -70.605],
    [-33.42, -70.61],
  ],
  waypoints: [
    [-33.4, -70.6],
    [-33.41, -70.605],
    [-33.42, -70.61],
  ],
  parent_name: null,
  ajustado: true,
  external_id: null,
  tipos_puntos: ["parada", "desvio", "parada"],
  categorias_puntos: [null, "carga", null],
};

describe("export places", () => {
  it("preserves delimiter, quote and newline characters on CSV round-trip", () => {
    const name = 'Demo; "quoted"\nsite';
    const address = 'Demo address; suite "A"';
    expect(filasCsv(exportarCsv([{ ...base, name, address }]))).toMatchObject([
      { name, address, lat: -33.4, lon: -70.6 },
    ]);
  });

  it("exports spreadsheet formulas as text while retaining numeric coordinates", () => {
    const csv = exportarCsv([{ ...base, name: "=1+2" }]);
    expect(filasCsv(csv)).toMatchObject([
      { name: "'=1+2", lat: -33.4, lon: -70.6 },
    ]);
  });
  it("offers CSV only for places", () => {
    expect(formatosPara("lugares")).toContain("csv");
    expect(formatosPara("trayectos")).not.toContain("csv");
    expect(formatosPara("ambos")).not.toContain("csv");
  });

  it("round-trips places and routes through GeoJSON", () => {
    const texto = contenidoExport(
      "ambos",
      "geojson",
      [base, poligono],
      [trayecto]
    );
    const filas = filasGeoJson(texto);
    expect(filas.map((f) => [f.name, f.geometry_type])).toEqual([
      ["Planta", "circle"],
      ["Bodega", "polygon"],
      ["Acceso norte", "line"],
    ]);
    expect(filas[0]?.radius_m).toBe(50);
    const linea = filas[2]!;
    expect(linea.waypoints).toEqual(trayecto.waypoints);
    expect(linea.tipos_puntos).toEqual(["parada", "desvio", "parada"]);
    expect(linea.points).toEqual(trayecto.points);
    expect(linea.ajustado).toBe(true);
    expect(linea.categorias_puntos).toEqual([null, "carga", null]);
  });

  it("round-trips routes through KML, keeping stops and deviations", () => {
    const texto = contenidoExport("trayectos", "kml", [base], [trayecto]);
    const filas = filasKml(texto);
    expect(filas).toHaveLength(1);
    expect(filas[0]?.geometry_type).toBe("line");
    expect(filas[0]?.tipos_puntos).toEqual(["parada", "desvio", "parada"]);
    expect(filas[0]?.waypoints).toEqual(trayecto.waypoints);
  });

  it("round-trips places through CSV", () => {
    const filas = filasCsv(exportarCsv([base, poligono]));
    expect(filas.map((f) => f.geometry_type)).toEqual(["circle", "polygon"]);
    expect(filas[1]?.vertices).toHaveLength(3);
  });

  it("names the file by what and when", () => {
    const dia = new Date("2026-10-15T12:00:00Z");
    expect(nombreArchivoExport("ambos", "kml", dia)).toBe(
      "lugares-y-trayectos-2026-10-15.kml"
    );
  });
});
