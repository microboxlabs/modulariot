// Exportación de lugares y trayectos en formatos que el import vuelve a leer:
// GeoJSON, KML y CSV (solo lugares). Funciones puras: arman el texto del
// archivo; la descarga la hace el componente.
import type { Feature } from "geojson";
import { anilloGeoJSON } from "../geofences/polygon-draw";
import type { LatLon, Lugar, Trayecto } from "../places.types";

export type QueExportar = "lugares" | "trayectos" | "ambos";
export type FormatoExport = "geojson" | "kml" | "csv";

export const FORMATOS_EXPORT: Record<
  FormatoExport,
  { label: string; ext: string; mime: string }
> = {
  geojson: { label: "GeoJSON", ext: "geojson", mime: "application/geo+json" },
  kml: {
    label: "KML",
    ext: "kml",
    mime: "application/vnd.google-earth.kml+xml",
  },
  csv: { label: "CSV", ext: "csv", mime: "text/csv" },
};

/** CSV no tiene cómo llevar un trayecto: solo con lugares. */
export const formatosPara = (que: QueExportar): FormatoExport[] =>
  que === "lugares" ? ["geojson", "kml", "csv"] : ["geojson", "kml"];

const lonLat = ([la, lo]: LatLon): [number, number] => [lo, la];
const esPoligono = (l: Lugar) => (l.polygon?.length ?? 0) >= 3;

/** Datos de un lugar que el import entiende (además de su geometría). */
function propsLugar(l: Lugar) {
  return {
    tipo: "lugar",
    name: l.name,
    address: l.address ?? null,
    external_id: l.external_id ?? null,
    category: l.category ?? null,
    ...(esPoligono(l) ? {} : { radius_m: l.radius_m ?? null }),
  };
}

/** Un trayecto: su camino como línea; A → B y sus tipos como propiedades. */
function propsTrayecto(t: Trayecto) {
  const waypoints = t.waypoints?.length ? t.waypoints : t.points;
  return {
    tipo: "trayecto",
    name: t.name,
    kind: t.kind,
    width_m: t.width_m ?? null,
    external_id: t.external_id ?? null,
    ajustado: Boolean(t.ajustado),
    waypoints: waypoints.map(lonLat),
    tipos_puntos: t.tipos_puntos ?? waypoints.map(() => "parada"),
    categorias_puntos: t.categorias_puntos ?? waypoints.map(() => null),
  };
}

export function exportarGeoJson(lugares: Lugar[], trayectos: Trayecto[]) {
  const features = [
    ...lugares.flatMap((l): Feature[] => {
      if (esPoligono(l)) {
        return [
          {
            type: "Feature",
            properties: propsLugar(l),
            geometry: {
              type: "Polygon",
              coordinates: [anilloGeoJSON(l.polygon ?? [])],
            },
          },
        ];
      }
      if (!l.center) return [];
      return [
        {
          type: "Feature",
          properties: propsLugar(l),
          geometry: { type: "Point", coordinates: lonLat(l.center) },
        },
      ];
    }),
    ...trayectos
      .filter((t) => t.points.length >= 2)
      .map(
        (t): Feature => ({
          type: "Feature",
          properties: propsTrayecto(t),
          geometry: { type: "LineString", coordinates: t.points.map(lonLat) },
        })
      ),
  ];
  return JSON.stringify({ type: "FeatureCollection", features }, null, 2);
}

const xml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const coordsKml = (pts: LatLon[]) =>
  pts.map(([la, lo]) => `${lo},${la}`).join(" ");

type ValorDato =
  | string
  | number
  | boolean
  | null
  | (string | null | [number, number])[];

/** <ExtendedData>: los arreglos van como texto JSON. */
function datosKml(datos: Record<string, ValorDato>): string {
  const filas = Object.entries(datos)
    .filter(([k, v]) => v != null && k !== "name")
    .map(([k, v]) => {
      const valor = typeof v === "object" ? JSON.stringify(v) : String(v);
      return `<Data name="${xml(k)}"><value>${xml(valor)}</value></Data>`;
    });
  return filas.length ? `<ExtendedData>${filas.join("")}</ExtendedData>` : "";
}

function placemarkLugar(l: Lugar): string {
  let geom = "";
  if (esPoligono(l)) {
    const poly = l.polygon ?? [];
    // anillo cerrado: el primer punto se repite al final
    const anillo = poly[0] ? [...poly, poly[0]] : poly;
    geom = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coordsKml(anillo)}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
  } else if (l.center) {
    geom = `<Point><coordinates>${coordsKml([l.center])}</coordinates></Point>`;
  } else return "";
  const dir = l.address ? `<address>${xml(l.address)}</address>` : "";
  return `<Placemark><name>${xml(l.name)}</name>${dir}${datosKml(propsLugar(l))}${geom}</Placemark>`;
}

function placemarkTrayecto(t: Trayecto): string {
  if (t.points.length < 2) return "";
  return `<Placemark><name>${xml(t.name)}</name>${datosKml(propsTrayecto(t))}<LineString><coordinates>${coordsKml(t.points)}</coordinates></LineString></Placemark>`;
}

export function exportarKml(lugares: Lugar[], trayectos: Trayecto[]) {
  const marcas = [
    ...lugares.map(placemarkLugar),
    ...trayectos.map(placemarkTrayecto),
  ].filter(Boolean);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2"><Document>',
    ...marcas,
    "</Document></kml>",
  ].join("\n");
}

/** Separador ";": la columna wkt lleva comas. */
const SEP = ";";
function celda(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Spreadsheet formula prefixes are data, not executable cells; coordinates stay numeric.
  if (typeof value === "string" && /^[=+@\-\t\r]/.test(text.trimStart()))
    text = "'" + text;
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportarCsv(lugares: Lugar[]) {
  const head = [
    "name",
    "lat",
    "lon",
    "radius_m",
    "wkt",
    "address",
    "external_id",
  ];
  const filas = lugares.flatMap((l) => {
    const poly = esPoligono(l);
    const centro = l.center ?? l.polygon?.[0];
    if (!centro) return [];
    const wkt = poly
      ? `POLYGON((${anilloGeoJSON(l.polygon ?? [])
          .map(([lo, la]) => `${lo} ${la}`)
          .join(", ")}))`
      : "";
    return [
      [
        l.name,
        centro[0],
        centro[1],
        poly ? "" : (l.radius_m ?? ""),
        wkt,
        l.address,
        l.external_id,
      ]
        .map(celda)
        .join(SEP),
    ];
  });
  return [head.join(SEP), ...filas].join("\n");
}

/** Texto del archivo según qué y en qué formato. */
export function contenidoExport(
  que: QueExportar,
  formato: FormatoExport,
  lugares: Lugar[],
  trayectos: Trayecto[]
): string {
  const ls = que === "trayectos" ? [] : lugares;
  const ts = que === "lugares" ? [] : trayectos;
  if (formato === "kml") return exportarKml(ls, ts);
  if (formato === "csv") return exportarCsv(ls);
  return exportarGeoJson(ls, ts);
}

export function nombreArchivoExport(
  que: QueExportar,
  formato: FormatoExport,
  fecha = new Date()
): string {
  const dia = fecha.toISOString().slice(0, 10);
  const base = que === "ambos" ? "lugares-y-trayectos" : que;
  return `${base}-${dia}.${FORMATOS_EXPORT[formato].ext}`;
}
