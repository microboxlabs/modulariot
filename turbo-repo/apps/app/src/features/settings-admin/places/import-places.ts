import JSZip from "jszip";
import {
  FORM_VACIO,
  type Categoria,
  type LatLon,
  type Lugar,
} from "./places.types";

export const MAX_FILAS_IMPORT = 500;
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
  geometry_type: "circle" | "polygon";
  vertices?: LatLon[];
};

export type LoteImport = {
  filename: string;
  formato: string;
  filas: FilaImport[];
};

export function filasDeLotes(lotes: LoteImport[] | undefined): FilaImport[] {
  return (lotes ?? []).flatMap((l) => l.filas ?? []);
}

type GeoLoose = {
  type?: string;
  name?: string;
  features?: GeoLoose[];
  geometry?: GeoLoose | null;
  geometries?: GeoLoose[];
  properties?: Record<string, string | number | boolean | null>;
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

function filaCirculo(
  name: string,
  lat: number,
  lon: number,
  extra: Partial<FilaImport> = {}
): FilaImport | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { name, lat, lon, geometry_type: "circle", ...extra };
}

function filaPoligono(
  name: string,
  vertices: LatLon[],
  extra: Partial<FilaImport> = {}
): FilaImport | null {
  if (vertices.length < 3) return null;
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
    const lon = c[0];
    const lat = c[1];
    if (lat == null || lon == null) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const p: LatLon = [lat, lon];
    const prev = vs[vs.length - 1];
    if (prev && mismoPunto(prev, p)) continue;
    vs.push(p);
  }
  const first = vs[0];
  const last = vs[vs.length - 1];
  if (first && last && vs.length > 1 && mismoPunto(first, last)) vs.pop();
  return vs;
}

/** 2 esquinas opuestas o 4 números bbox → rectángulo como polígono. */
export function poligonoDesdeEnvolvente(puntos: number[][]): LatLon[] | null {
  if (puntos.length === 2) {
    const a = puntos[0];
    const b = puntos[1];
    if (!a || !b || a[0] == null || a[1] == null || b[0] == null || b[1] == null)
      return null;
    const west = Math.min(a[0], b[0]);
    const east = Math.max(a[0], b[0]);
    const south = Math.min(a[1], b[1]);
    const north = Math.max(a[1], b[1]);
    return poligonoDesdeBbox(west, south, east, north);
  }
  if (puntos.length === 1 && puntos[0]?.length === 4) {
    const box = puntos[0];
    if (
      box[0] == null ||
      box[1] == null ||
      box[2] == null ||
      box[3] == null
    )
      return null;
    return poligonoDesdeBbox(box[0], box[1], box[2], box[3]);
  }
  return null;
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
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function extraDeProps(props: GeoLoose["properties"]): Partial<FilaImport> {
  const address = props?.address ?? props?.direccion;
  const external = props?.external_id ?? props?.id_externo;
  const radio = props?.radius_m ?? props?.radio;
  const extra: Partial<FilaImport> = {};
  if (address != null && String(address).trim())
    extra.address = String(address).trim();
  if (external != null && String(external).trim())
    extra.external_id = String(external).trim();
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

function poligonosDeCoords(
  type: string,
  coords: GeoLoose["coordinates"]
): LatLon[][] {
  const t = type.toLowerCase();
  if (t === "rectangle" || t === "square" || t === "envelope") {
    const pares = coordsComoPares(coords);
    const env = poligonoDesdeEnvolvente(pares);
    if (env) return [env];
    const vs = verticesDesdeAnillo(pares);
    return vs.length >= 3 ? [vs] : [];
  }
  if (t === "polygon") {
    const vs = verticesDesdeAnillo(primerAnillo(coords));
    return vs.length >= 3 ? [vs] : [];
  }
  if (t === "multipolygon" && Array.isArray(coords)) {
    const out: LatLon[][] = [];
    for (const poly of coords) {
      if (!Array.isArray(poly)) continue;
      const ring = Array.isArray(poly[0]) ? (poly[0] as number[][]) : [];
      const vs = verticesDesdeAnillo(ring);
      if (vs.length >= 3) out.push(vs);
    }
    return out;
  }
  return [];
}

function filasDesdeGeometria(
  geom: GeoLoose | null | undefined,
  nombre: string,
  extra: Partial<FilaImport>,
  bbox?: number[]
): FilaImport[] {
  if (geom?.type === "GeometryCollection" && Array.isArray(geom.geometries)) {
    return geom.geometries.flatMap((g, i) =>
      filasDesdeGeometria(g, `${nombre} ${i + 1}`, extra, bbox)
    );
  }
  const type = geom?.type ?? "";
  if (type === "Point") {
    const c = geom?.coordinates;
    if (!Array.isArray(c) || typeof c[0] !== "number") return [];
    const lon = c[0];
    const lat = c[1];
    if (typeof lon !== "number" || typeof lat !== "number") return [];
    const fila = filaCirculo(nombre, lat, lon, extra);
    return fila ? [fila] : [];
  }
  const polys = poligonosDeCoords(type, geom?.coordinates);
  if (polys.length > 0) {
    return polys.flatMap((vs, i) => {
      const fila = filaPoligono(
        polys.length > 1 ? `${nombre} ${i + 1}` : nombre,
        vs,
        extra
      );
      return fila ? [fila] : [];
    });
  }
  if (bbox && bbox.length >= 4) {
    const [west, south, east, north] = bbox;
    if (
      west == null ||
      south == null ||
      east == null ||
      north == null
    )
      return [];
    const fila = filaPoligono(
      nombre,
      poligonoDesdeBbox(west, south, east, north),
      extra
    );
    return fila ? [fila] : [];
  }
  return [];
}

function filasDesdeFeature(feat: GeoLoose, fallback: string): FilaImport[] {
  const nombre = nombreDeProps(feat.properties, feat.name ?? fallback);
  const extra = extraDeProps(feat.properties);
  return filasDesdeGeometria(
    feat.geometry ?? feat,
    nombre,
    extra,
    feat.bbox ?? feat.geometry?.bbox
  );
}

export function filasGeoJson(texto: string): FilaImport[] {
  let data: GeoLoose;
  try {
    data = JSON.parse(texto) as GeoLoose;
  } catch {
    return [];
  }
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
    .split(/[\s\n]+/)
    .map((t) => t.split(",").map(Number))
    .filter((p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

function textoDe(el: Element | null): string {
  return el?.textContent?.trim() ?? "";
}

function hijoTag(el: Element, tag: string): Element | undefined {
  return el.getElementsByTagName(tag)[0];
}

function filaDesdePlacemark(pm: Element): FilaImport | null {
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
  const point = hijoTag(pm, "Point");
  const pointCoords = point ? hijoTag(point, "coordinates") : undefined;
  if (pointCoords?.textContent) {
    const [lon, lat] = paresCoordsKml(pointCoords.textContent)[0] ?? [];
    if (lat == null || lon == null) return null;
    return filaCirculo(name, lat, lon, extra);
  }
  return null;
}

export function filasKml(xml: string): FilaImport[] {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const filas = [...doc.getElementsByTagName("Placemark")]
    .map(filaDesdePlacemark)
    .filter((r): r is FilaImport => r != null);
  return acotar(filas);
}

async function filasKmz(file: File): Promise<FilaImport[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = Object.values(zip.files).find((f) =>
    f.name.toLowerCase().endsWith(".kml")
  );
  if (!entry) return [];
  return filasKml(await entry.async("text"));
}

function col(
  head: string[],
  row: string[],
  ...names: string[]
): string | null {
  for (const n of names) {
    const i = head.indexOf(n);
    if (i >= 0 && row[i]?.trim()) return row[i].trim();
  }
  return null;
}

function verticesDesdeWkt(wkt: string): LatLon[] {
  const m = wkt.match(/polygon\s*\(\s*\(\s*(.+?)\s*\)\s*\)/i);
  if (!m?.[1]) return [];
  const pares = m[1].split(",").map((p) =>
    p
      .trim()
      .split(/[\s]+/)
      .map(Number)
  );
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
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon))
      continue;
    vs.push([lat, lon]);
  }
  const first = vs[0];
  const last = vs[vs.length - 1];
  if (first && last && vs.length > 1 && mismoPunto(first, last)) vs.pop();
  return vs;
}

export function filasCsv(texto: string): FilaImport[] {
  const lineas = texto.split(/\r?\n/).filter((x) => x.trim());
  const sep = lineas[0]?.includes(";") ? ";" : ",";
  const head = (lineas[0] ?? "").split(sep).map((h) => h.trim().toLowerCase());
  const filas: FilaImport[] = [];
  for (const ln of lineas.slice(1)) {
    const r = ln.split(sep);
    const valor = (...names: string[]) => col(head, r, ...names);
    const name = valor("name", "nombre") ?? "Sin nombre";
    const address = valor("address", "direccion") ?? undefined;
    const external_id = valor("external_id", "id_externo") ?? undefined;
    const extra: Partial<FilaImport> = {};
    if (address) extra.address = address;
    if (external_id) extra.external_id = external_id;
    const wkt = valor("wkt", "polygon", "geometria");
    const lista = valor("vertices", "vertex", "puntos");
    const vs = wkt
      ? verticesDesdeWkt(wkt)
      : lista
        ? verticesDesdeLista(lista)
        : [];
    if (vs.length >= 3) {
      const fila = filaPoligono(name, vs, extra);
      if (fila) filas.push(fila);
      continue;
    }
    const westRaw = valor("west", "min_lon", "minx");
    const eastRaw = valor("east", "max_lon", "maxx");
    const southRaw = valor("south", "min_lat", "miny");
    const northRaw = valor("north", "max_lat", "maxy");
    const west = Number(westRaw);
    const east = Number(eastRaw);
    const south = Number(southRaw);
    const north = Number(northRaw);
    if (
      westRaw &&
      eastRaw &&
      southRaw &&
      northRaw &&
      [west, east, south, north].every(Number.isFinite)
    ) {
      const fila = filaPoligono(
        name,
        poligonoDesdeBbox(west, south, east, north),
        extra
      );
      if (fila) filas.push(fila);
      continue;
    }
    const lat = Number(valor("lat", "latitud"));
    const lon = Number(valor("lon", "lng", "longitud"));
    const radioRaw = valor("radius_m", "radio");
    if (radioRaw) extra.radius_m = Number(radioRaw);
    const fila = filaCirculo(name, lat, lon, extra);
    if (fila) filas.push(fila);
  }
  return acotar(filas);
}

export function parsearTextoLugares(
  nombre: string,
  texto: string
): { formato: string; filas: FilaImport[] } {
  const ext = extensionDe(nombre);
  if (ext === "kml") return { formato: "kml", filas: filasKml(texto) };
  if (ext === "geojson" || ext === "json")
    return { formato: "geojson", filas: filasGeoJson(texto) };
  return { formato: "csv", filas: filasCsv(texto) };
}

export async function parsearArchivoLugares(
  file: File
): Promise<{ formato: string; filas: FilaImport[] }> {
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

export function formaFilaImport(fila: FilaImport): string {
  return filaEsPoligono(fila) ? "Polígono" : "Círculo";
}

export function detalleFilaImport(fila: FilaImport): string {
  if (filaEsPoligono(fila)) {
    return `${fila.vertices?.length ?? 0} vértices`;
  }
  return `${fila.lat.toFixed(3)}, ${fila.lon.toFixed(3)}`;
}
