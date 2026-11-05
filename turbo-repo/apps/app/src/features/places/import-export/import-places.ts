import JSZip from "jszip";
import { parse as parseCsv } from "csv-parse/browser/esm/sync";
import { DOMParser, type Element as NodoXml } from "@xmldom/xmldom";
import { z } from "zod";
import {
  FORM_VACIO,
  type Categoria,
  type LatLon,
  type Lugar,
  type TipoPunto,
} from "../places.types";
import { MAX_PUNTOS } from "../routes/recorrido";

export const MAX_FILAS_IMPORT = 500;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

function checkImportSize(bytes: number) {
  if (bytes > MAX_IMPORT_BYTES)
    throw new RangeError("Import exceeds the 8 MiB limit");
}
export const ACCEPT_IMPORT = ".csv,.kml,.kmz,.geojson,.json";

const EXTS_IMPORT = ACCEPT_IMPORT.split(",").map((e) => e.trim());

export function esArchivoImport(file: File): boolean {
  const n = file.name.toLowerCase();
  return EXTS_IMPORT.some((ext) => n.endsWith(ext));
}

export type FilaImport = {
  name: string;
  lat: number;
  lon: number;
  radius_m?: number;
  address?: string | null;
  external_id?: string;
  /** "line" = un trayecto: su camino y sus puntos A → B. */
  geometry_type: "circle" | "polygon" | "line";
  vertices?: LatLon[];
  /** Trayecto: el camino dibujado (por calles o en línea recta). */
  points?: LatLon[];
  /** Trayecto: A, paradas y desvíos, B (en orden). */
  waypoints?: LatLon[];
  /** Trayecto: parada o desvío de cada waypoint. */
  tipos_puntos?: TipoPunto[];
  /** Trayecto: categoría de cada waypoint (null = sin categoría). */
  categorias_puntos?: (string | null)[];
  kind?: "vial" | "interno";
  width_m?: number;
  ajustado?: boolean;
  /** Lo pone el gestor de conflictos al cargar el archivo. */
  uid?: string;
};

export type LoteImport = {
  filename: string;
  formato: string;
  filas: FilaImport[];
};

export function filasDeLotes(lotes: LoteImport[] | undefined): FilaImport[] {
  return (lotes ?? []).flatMap((l) => l.filas ?? []);
}

type ValorJson =
  | string
  | number
  | boolean
  | null
  | ValorJson[]
  | { [k: string]: ValorJson };

type GeoLoose = {
  type?: string;
  name?: string;
  features?: GeoLoose[];
  geometry?: GeoLoose | null;
  geometries?: GeoLoose[];
  properties?: Record<string, ValorJson>;
  coordinates?: number[] | number[][] | number[][][] | number[][][][];
  bbox?: number[];
};

function extensionDe(nombre: string): string {
  return nombre.toLowerCase().split(".").pop() ?? "";
}

function mismoPunto(a: LatLon, b: LatLon): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function centroDe(vertices: LatLon[]): LatLon {
  const n = Math.max(vertices.length, 1);
  return [
    vertices.reduce((s, v) => s + v[0], 0) / n,
    vertices.reduce((s, v) => s + v[1], 0) / n,
  ];
}

function validCoordinates(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

function filaCirculo(
  name: string,
  lat: number,
  lon: number,
  extra: Partial<FilaImport> = {}
): FilaImport | null {
  if (!validCoordinates(lat, lon)) return null;
  return { name, lat, lon, geometry_type: "circle", ...extra };
}

function filaPoligono(
  name: string,
  vertices: LatLon[],
  extra: Partial<FilaImport> = {}
): FilaImport | null {
  if (
    vertices.length < 3 ||
    vertices.some(([lat, lon]) => !validCoordinates(lat, lon))
  )
    return null;
  const [lat, lon] = centroDe(vertices);
  return {
    name,
    lat,
    lon,
    geometry_type: "polygon",
    vertices,
    ...extra,
  };
}

/** Bbox / dos esquinas opuestas → polígono rectangular (4 vértices). */
export function poligonoDesdeBbox(
  west: number,
  south: number,
  east: number,
  north: number
): LatLon[] {
  return [
    [south, west],
    [south, east],
    [north, east],
    [north, west],
  ];
}

/**
 * Anillo GeoJSON [lon, lat] → vértices [lat, lon] sin repetir el cierre.
 * Un cuadrado o rectángulo (4 esquinas) queda como polígono del sistema.
 */
export function verticesDesdeAnillo(coords: number[][]): LatLon[] {
  const vs: LatLon[] = [];
  for (const c of coords) {
    if (!Array.isArray(c)) return [];
    const lon = c[0];
    const lat = c[1];
    if (lat == null || lon == null || !validCoordinates(lat, lon)) return [];
    const p: LatLon = [lat, lon];
    const prev = vs.at(-1);
    if (prev && mismoPunto(prev, p)) continue;
    vs.push(p);
  }
  const first = vs[0];
  const last = vs.at(-1);
  if (first && last && vs.length > 1 && mismoPunto(first, last)) vs.pop();
  return vs;
}

/** 2 esquinas opuestas o 4 números bbox → rectángulo como polígono. */
export function poligonoDesdeEnvolvente(puntos: number[][]): LatLon[] | null {
  if (puntos.length === 2) {
    const a = puntos[0];
    const b = puntos[1];
    if (
      !a ||
      !b ||
      a[0] == null ||
      a[1] == null ||
      b[0] == null ||
      b[1] == null
    )
      return null;
    const west = Math.min(a[0], b[0]);
    const east = Math.max(a[0], b[0]);
    const south = Math.min(a[1], b[1]);
    const north = Math.max(a[1], b[1]);
    return poligonoDesdeBbox(west, south, east, north);
  }
  if (puntos.length === 1 && puntos[0]?.length === 4) {
    const box = puntos[0];
    if (box[0] == null || box[1] == null || box[2] == null || box[3] == null)
      return null;
    return poligonoDesdeBbox(box[0], box[1], box[2], box[3]);
  }
  return null;
}

export const filaEsLinea = (fila: FilaImport) => fila.geometry_type === "line";

const paresSchema = z.array(z.tuple([z.number(), z.number()]).rest(z.number()));
const tiposSchema = z.array(z.enum(["parada", "desvio"]));
const categoriasSchema = z.array(z.string().nullable());

/** [lon, lat] (GeoJSON/KML) → [lat, lon] del sistema. */
function aLatLon(pares: number[][]): LatLon[] {
  if (
    pares.some(
      (pair) => !Array.isArray(pair) || !validCoordinates(pair[1], pair[0])
    )
  )
    return [];
  return pares.map(([lon, lat]) => [lat!, lon!]);
}

/** Lee un valor que puede venir como arreglo o como texto JSON (KML). */
function leerJson<T>(v: ValorJson | undefined, schema: z.ZodType<T>): T | null {
  let crudo: unknown = v;
  if (typeof v === "string") {
    try {
      crudo = JSON.parse(v);
    } catch {
      return null;
    }
  }
  const r = schema.safeParse(crudo);
  return r.success ? r.data : null;
}

/** Puntos A → B: los del archivo o, si faltan, los de la línea. */
function waypointsDeLinea(
  points: LatLon[],
  wpArchivo: number[][] | null
): LatLon[] {
  if (wpArchivo) return aLatLon(wpArchivo);
  if (points.length <= MAX_PUNTOS) return points;
  return [points[0]!, points.at(-1)!];
}

/**
 * Trayecto desde una línea: su camino son las coordenadas de la línea. Los
 * puntos A → B salen de `waypoints` si vienen; si no, con pocos vértices
 * (hasta MAX_PUNTOS) cada vértice es una parada, y con muchos la línea es el
 * camino ya trazado de su primer a su último punto.
 */
function filaLinea(
  nombre: string,
  coords: number[][],
  props: GeoLoose["properties"],
  extra: Partial<FilaImport>
): FilaImport | null {
  const points = aLatLon(coords);
  if (points.length < 2) return null;
  const wpArchivo = leerJson(props?.waypoints, paresSchema);
  const pocos = points.length <= MAX_PUNTOS;
  const waypoints = waypointsDeLinea(points, wpArchivo);
  if (waypoints.length < 2) return null;
  const tipos = leerJson(props?.tipos_puntos, tiposSchema);
  const categorias = leerJson(props?.categorias_puntos, categoriasSchema);
  const kind = props?.kind === "interno" ? "interno" : "vial";
  const ancho = Number(props?.width_m);
  const ajustado =
    typeof props?.ajustado === "boolean"
      ? props.ajustado
      : !wpArchivo && !pocos;
  return {
    ...extra,
    name: nombre,
    lat: waypoints[0]![0],
    lon: waypoints[0]![1],
    geometry_type: "line",
    points,
    waypoints,
    tipos_puntos:
      tipos?.length === waypoints.length
        ? tipos
        : waypoints.map(() => "parada"),
    ...(categorias?.length === waypoints.length
      ? { categorias_puntos: categorias }
      : {}),
    kind,
    width_m: Number.isFinite(ancho) && ancho > 0 ? ancho : undefined,
    ajustado,
  };
}

export function filaEsPoligono(fila: FilaImport): boolean {
  return fila.geometry_type === "polygon" && (fila.vertices?.length ?? 0) >= 3;
}

function acotar(filas: FilaImport[]): FilaImport[] {
  return filas.slice(0, MAX_FILAS_IMPORT);
}

function nombreDeProps(
  props: GeoLoose["properties"],
  fallback: string
): string {
  const v =
    props?.name ?? props?.nombre ?? props?.Name ?? props?.title ?? props?.id;
  return textoDeValor(v) || fallback;
}

/**
 * Texto de un valor del archivo: solo texto, números o sí/no. Un objeto o
 * una lista no es un nombre ni una dirección: queda vacío.
 */
function textoDeValor(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

function extraDeProps(props: GeoLoose["properties"]): Partial<FilaImport> {
  const address = props?.address ?? props?.direccion;
  const external = props?.external_id ?? props?.id_externo;
  const radio = props?.radius_m ?? props?.radio;
  const extra: Partial<FilaImport> = {};
  const direccion = textoDeValor(address);
  if (direccion) extra.address = direccion;
  const externo = textoDeValor(external);
  if (externo) extra.external_id = externo;
  if (typeof radio === "number" && Number.isFinite(radio))
    extra.radius_m = radio;
  if (typeof radio === "string" && Number.isFinite(Number(radio)))
    extra.radius_m = Number(radio);
  return extra;
}

function coordsComoPares(coords: GeoLoose["coordinates"]): number[][] {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const first = coords[0];
  if (typeof first === "number") return [coords as number[]];
  if (!Array.isArray(first)) return [];
  if (typeof first[0] === "number") return coords as number[][];
  return [];
}

function primerAnillo(coords: GeoLoose["coordinates"]): number[][] {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const ring = coords[0];
  if (!Array.isArray(ring) || ring.length === 0) return [];
  if (typeof ring[0] === "number") return coords as number[][];
  const inner = ring[0];
  if (Array.isArray(inner) && typeof inner[0] === "number")
    return ring as number[][];
  if (Array.isArray(inner) && Array.isArray(inner[0]))
    return inner as number[][];
  return [];
}

/** Un anillo válido (3+ vértices) como lista de un polígono; si no, ninguno. */
const comoPoligonos = (vs: LatLon[]): LatLon[][] =>
  vs.length >= 3 ? [vs] : [];

/** Una fila, o ninguna si no se pudo armar. */
const comoFilas = (fila: FilaImport | null): FilaImport[] =>
  fila ? [fila] : [];

/** "Ruta 1", "Ruta 2"… solo si la geometría trae varias partes. */
const nombreDeParte = (nombre: string, i: number, total: number) =>
  total > 1 ? `${nombre} ${i + 1}` : nombre;

const TIPOS_ENVOLVENTE = new Set(["rectangle", "square", "envelope"]);

function poligonoDeEnvolvente(coords: GeoLoose["coordinates"]): LatLon[][] {
  const pares = coordsComoPares(coords);
  const env = poligonoDesdeEnvolvente(pares);
  return env ? [env] : comoPoligonos(verticesDesdeAnillo(pares));
}

function poligonosDeMulti(coords: unknown[]): LatLon[][] {
  return coords.flatMap((poly) => {
    if (!Array.isArray(poly)) return [];
    const ring = Array.isArray(poly[0]) ? (poly[0] as number[][]) : [];
    return comoPoligonos(verticesDesdeAnillo(ring));
  });
}

function poligonosDeCoords(
  type: string,
  coords: GeoLoose["coordinates"]
): LatLon[][] {
  const t = type.toLowerCase();
  if (TIPOS_ENVOLVENTE.has(t)) return poligonoDeEnvolvente(coords);
  if (t === "polygon")
    return comoPoligonos(verticesDesdeAnillo(primerAnillo(coords)));
  if (t === "multipolygon" && Array.isArray(coords))
    return poligonosDeMulti(coords);
  return [];
}

function filaDePunto(
  coords: GeoLoose["coordinates"],
  nombre: string,
  extra: Partial<FilaImport>
): FilaImport[] {
  if (!Array.isArray(coords)) return [];
  const [lon, lat] = coords;
  if (typeof lon !== "number" || typeof lat !== "number") return [];
  return comoFilas(filaCirculo(nombre, lat, lon, extra));
}

function filasDeMultiLinea(
  partes: number[][][],
  nombre: string,
  extra: Partial<FilaImport>,
  props?: GeoLoose["properties"]
): FilaImport[] {
  return partes.flatMap((linea, i) =>
    comoFilas(
      filaLinea(nombreDeParte(nombre, i, partes.length), linea, props, extra)
    )
  );
}

function filaDeBbox(
  bbox: number[],
  nombre: string,
  extra: Partial<FilaImport>
): FilaImport[] {
  const [west, south, east, north] = bbox;
  if (west == null || south == null || east == null || north == null) return [];
  return comoFilas(
    filaPoligono(nombre, poligonoDesdeBbox(west, south, east, north), extra)
  );
}

function filasDesdeGeometria(
  geom: GeoLoose | null | undefined,
  nombre: string,
  extra: Partial<FilaImport>,
  bbox?: number[],
  props?: GeoLoose["properties"]
): FilaImport[] {
  if (geom?.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
    return geom.geometries.flatMap((g, i) =>
      filasDesdeGeometria(g, `${nombre} ${i + 1}`, extra, bbox, props)
    );
  }
  const type = typeof geom?.type === "string" ? geom.type : "";
  const coords = geom?.coordinates;
  if (type === "Point") return filaDePunto(coords, nombre, extra);
  if (type === "LineString")
    return comoFilas(filaLinea(nombre, coordsComoPares(coords), props, extra));
  if (type === "MultiLineString" && Array.isArray(coords))
    return filasDeMultiLinea(coords as number[][][], nombre, extra, props);
  const polys = poligonosDeCoords(type, coords);
  if (polys.length > 0) {
    return polys.flatMap((vs, i) =>
      comoFilas(filaPoligono(nombreDeParte(nombre, i, polys.length), vs, extra))
    );
  }
  if (bbox && bbox.length >= 4) return filaDeBbox(bbox, nombre, extra);
  return [];
}

function filasDesdeFeature(feat: GeoLoose, fallback: string): FilaImport[] {
  if (feat === null || typeof feat !== "object" || Array.isArray(feat))
    return [];
  const nombre = nombreDeProps(feat.properties, feat.name ?? fallback);
  const extra = extraDeProps(feat.properties);
  return filasDesdeGeometria(
    feat.geometry ?? feat,
    nombre,
    extra,
    feat.bbox ?? feat.geometry?.bbox,
    feat.properties
  );
}

export function filasGeoJson(texto: string): FilaImport[] {
  let data: GeoLoose;
  try {
    data = JSON.parse(texto) as GeoLoose;
  } catch {
    return [];
  }
  if (data === null || typeof data !== "object" || Array.isArray(data))
    return [];
  if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
    return acotar(
      data.features.flatMap((f, i) => filasDesdeFeature(f, `Lugar ${i + 1}`))
    );
  }
  if (data.type === "Feature") return acotar(filasDesdeFeature(data, "Lugar"));
  return acotar(filasDesdeGeometria(data, "Lugar", {}, data.bbox));
}

function paresCoordsKml(texto: string): number[][] {
  return texto
    .trim()
    .split(/\s+/)
    .map((t) => t.split(",").map(Number))
    .filter(
      (p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
    );
}

/** Avisos del parser XML: se ignoran; uno fatal corta el parseo (catch). */
function ignorarErrorXml() {
  // sin consola: un KML con detalles menores igual se importa
}

function textoDe(el: NodoXml | null): string {
  return el?.textContent?.trim() ?? "";
}

function hijoTag(el: NodoXml, tag: string): NodoXml | undefined {
  return el.getElementsByTagName(tag)[0];
}

/** <ExtendedData><Data name="…"><value>…</value></Data>…: como propiedades. */
function datosExtendidos(pm: NodoXml): Record<string, ValorJson> {
  const out: Record<string, ValorJson> = {};
  for (const d of pm.getElementsByTagName("Data")) {
    const nombre = d.getAttribute("name");
    if (!nombre) continue;
    const valor = textoDe(hijoTag(d, "value") ?? null);
    if (valor === "true" || valor === "false") out[nombre] = valor === "true";
    else out[nombre] = valor;
  }
  return out;
}

function filaDesdePlacemark(pm: NodoXml): FilaImport | null {
  const name = textoDe(hijoTag(pm, "name") ?? null) || "Sin nombre";
  const address = textoDe(hijoTag(pm, "address") ?? null) || undefined;
  const extra: Partial<FilaImport> = address ? { address } : {};
  const poly = hijoTag(pm, "Polygon") ?? hijoTag(pm, "LinearRing");
  const polyCoords = poly ? hijoTag(poly, "coordinates") : undefined;
  if (polyCoords?.textContent) {
    const vs = verticesDesdeAnillo(paresCoordsKml(polyCoords.textContent));
    return filaPoligono(name, vs, extra);
  }
  const box = hijoTag(pm, "LatLonBox");
  if (box) {
    const west = Number(textoDe(hijoTag(box, "west") ?? null));
    const east = Number(textoDe(hijoTag(box, "east") ?? null));
    const south = Number(textoDe(hijoTag(box, "south") ?? null));
    const north = Number(textoDe(hijoTag(box, "north") ?? null));
    if ([west, east, south, north].every(Number.isFinite)) {
      return filaPoligono(
        name,
        poligonoDesdeBbox(west, south, east, north),
        extra
      );
    }
  }
  const linea = hijoTag(pm, "LineString");
  const lineaCoords = linea ? hijoTag(linea, "coordinates") : undefined;
  if (lineaCoords?.textContent) {
    return filaLinea(
      name,
      paresCoordsKml(lineaCoords.textContent),
      datosExtendidos(pm),
      extra
    );
  }
  const point = hijoTag(pm, "Point");
  const pointCoords = point ? hijoTag(point, "coordinates") : undefined;
  if (pointCoords?.textContent) {
    const [lon, lat] = paresCoordsKml(pointCoords.textContent)[0] ?? [];
    if (lat == null || lon == null) return null;
    return filaCirculo(name, lat, lon, extra);
  }
  return null;
}

/**
 * El KML se lee con un parser XML propio (xmldom), no con el DOMParser del
 * navegador: el contenido del archivo nunca llega a ser DOM de la página. Un
 * archivo mal formado no rompe el import: queda sin filas.
 */
export function filasKml(xml: string): FilaImport[] {
  let doc;
  try {
    doc = new DOMParser({ onError: ignorarErrorXml }).parseFromString(
      xml,
      "text/xml"
    );
  } catch {
    return [];
  }
  const filas = [...doc.getElementsByTagName("Placemark")]
    .map(filaDesdePlacemark)
    .filter((r): r is FilaImport => r != null);
  return acotar(filas);
}

// JSZip documents this browser streaming API, but omits it from JSZipObject's types.
type StreamingZipObject = JSZip.JSZipObject & {
  internalStream(type: "uint8array"): JSZip.JSZipStreamHelper<Uint8Array>;
};

function readKmlEntry(entry: JSZip.JSZipObject): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = (entry as StreamingZipObject).internalStream("uint8array");
    const decoder = new TextDecoder();
    const parts: string[] = [];
    let size = 0;
    let stopped = false;
    stream.on("data", (chunk) => {
      if (stopped) return;
      size += chunk.length;
      try {
        checkImportSize(size);
        parts.push(decoder.decode(chunk, { stream: true }));
      } catch (error) {
        stopped = true;
        stream.pause();
        reject(error);
      }
    });
    stream.on("error", reject);
    stream.on("end", () => resolve(parts.join("") + decoder.decode()));
    stream.resume();
  });
}

async function filasKmz(file: File): Promise<FilaImport[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = Object.values(zip.files).find((f) =>
    f.name.toLowerCase().endsWith(".kml")
  );
  if (!entry) return [];
  return filasKml(await readKmlEntry(entry));
}

function col(head: string[], row: string[], ...names: string[]): string | null {
  for (const n of names) {
    const i = head.indexOf(n);
    if (i >= 0 && row[i]?.trim()) return row[i].trim();
  }
  return null;
}

/**
 * Lo de adentro de "POLYGON ((x y, x y, …))", buscado con indexOf (sin regex
 * con retroceso: un texto largo no se vuelve lento).
 */
function anilloWkt(wkt: string): string | null {
  const t = wkt.toLowerCase();
  const inicio = t.indexOf("polygon");
  if (inicio < 0) return null;
  const a = t.indexOf("(", inicio);
  const b = a < 0 ? -1 : t.indexOf("(", a + 1);
  if (b < 0 || t.slice(a + 1, b).trim()) return null;
  const c = t.indexOf(")", b + 1);
  return c < 0 ? null : wkt.slice(b + 1, c).trim() || null;
}

function verticesDesdeWkt(wkt: string): LatLon[] {
  const anillo = anilloWkt(wkt);
  if (!anillo) return [];
  const pares = anillo.split(",").map((p) => p.trim().split(/\s+/).map(Number));
  return verticesDesdeAnillo(pares);
}

function verticesDesdeLista(raw: string): LatLon[] {
  const pares = raw
    .split(/[;|]/)
    .map((p) => p.split(",").map(Number))
    .filter((p) => p.length >= 2);
  // CSV lista es lat,lon (sistema), no lon,lat.
  const vs: LatLon[] = [];
  for (const p of pares) {
    const lat = p[0];
    const lon = p[1];
    if (
      lat == null ||
      lon == null ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon)
    )
      continue;
    vs.push([lat, lon]);
  }
  const first = vs[0];
  const last = vs.at(-1);
  if (first && last && vs.length > 1 && mismoPunto(first, last)) vs.pop();
  return vs;
}

/** Valor de una columna de la fila CSV, por cualquiera de sus nombres. */
type ValorCsv = (...names: string[]) => string | null;

/** Vértices escritos en WKT o como lista "lat,lon;lat,lon". */
function verticesDeCsv(valor: ValorCsv): LatLon[] {
  const wkt = valor("wkt", "polygon", "geometria");
  if (wkt) return verticesDesdeWkt(wkt);
  const lista = valor("vertices", "vertex", "puntos");
  return lista ? verticesDesdeLista(lista) : [];
}

/** Caja oeste/sur/este/norte, solo si vienen las cuatro y son números. */
function bboxDeCsv(valor: ValorCsv): [number, number, number, number] | null {
  const crudos = [
    valor("west", "min_lon", "minx"),
    valor("south", "min_lat", "miny"),
    valor("east", "max_lon", "maxx"),
    valor("north", "max_lat", "maxy"),
  ];
  if (crudos.some((c) => !c)) return null;
  const [west, south, east, north] = crudos.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  return [west, south, east, north].every(Number.isFinite)
    ? [west, south, east, north]
    : null;
}

function extraDeCsv(valor: ValorCsv): Partial<FilaImport> {
  const extra: Partial<FilaImport> = {};
  const address = valor("address", "direccion");
  const externalId = valor("external_id", "id_externo");
  if (address) extra.address = address;
  if (externalId) extra.external_id = externalId;
  return extra;
}

/** Una fila del CSV: polígono (WKT, lista o caja) o, si no, círculo. */
function filaDesdeCsv(valor: ValorCsv): FilaImport | null {
  const name = valor("name", "nombre") ?? "Sin nombre";
  const extra = extraDeCsv(valor);
  const vs = verticesDeCsv(valor);
  if (vs.length >= 3) return filaPoligono(name, vs, extra);
  const bbox = bboxDeCsv(valor);
  if (bbox) {
    const [west, south, east, north] = bbox;
    return filaPoligono(
      name,
      poligonoDesdeBbox(west, south, east, north),
      extra
    );
  }
  const latRaw = valor("lat", "latitud");
  const lonRaw = valor("lon", "lng", "longitud");
  if (latRaw === null || lonRaw === null) return null;
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  const radioRaw = valor("radius_m", "radio");
  if (radioRaw) extra.radius_m = Number(radioRaw);
  return filaCirculo(name, lat, lon, extra);
}

export function filasCsv(texto: string): FilaImport[] {
  const first = texto.split(/\r?\n/, 1)[0] ?? "";
  const sep = first.includes(";") ? ";" : ",";
  let rows: string[][];
  try {
    rows = parseCsv(texto, {
      delimiter: sep,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as string[][];
  } catch {
    return [];
  }
  const head = (rows[0] ?? []).map((name) => name.toLowerCase());
  const filas = rows
    .slice(1)
    .flatMap((row) =>
      comoFilas(filaDesdeCsv((...names) => col(head, row, ...names)))
    );
  return acotar(filas);
}

export function parsearTextoLugares(
  nombre: string,
  texto: string
): { formato: string; filas: FilaImport[] } {
  checkImportSize(texto.length);
  const ext = extensionDe(nombre);
  if (ext === "kml") return { formato: "kml", filas: filasKml(texto) };
  if (ext === "geojson" || ext === "json")
    return { formato: "geojson", filas: filasGeoJson(texto) };
  return { formato: "csv", filas: filasCsv(texto) };
}

export async function parsearArchivoLugares(
  file: File
): Promise<{ formato: string; filas: FilaImport[] }> {
  checkImportSize(file.size);
  if (extensionDe(file.name) === "kmz") {
    return { formato: "kmz", filas: await filasKmz(file) };
  }
  return parsearTextoLugares(file.name, await file.text());
}

export function lugarDesdeFilaImport(
  fila: FilaImport,
  cats: Categoria[],
  placeId: string,
  categoryId: number | null
): Lugar {
  const poly = filaEsPoligono(fila);
  const cat = cats.find((c) => c.category_id === categoryId);
  return {
    place_id: placeId,
    name: fila.name,
    address: fila.address ?? null,
    category: cat?.name ?? null,
    category_id: categoryId,
    geometry_type: poly ? "polygon" : "circle",
    color: cat?.color ?? null,
    center: [fila.lat, fila.lon],
    polygon: poly ? (fila.vertices ?? []) : null,
    radius_m: poly ? null : (fila.radius_m ?? FORM_VACIO.radius_m),
    metadata: null,
    icon: null,
    external_id: fila.external_id ?? null,
    active_from: null,
    active_until: null,
  };
}
