import {
  INNER_RADIO_DEFAULT,
  INNER_RADIO_MIN,
  INNER_RECT_H_DEF,
  INNER_RECT_W_DEF,
  aplicarFormaBase,
  aplicarGeomKind,
  distanciaM,
  esRectVinculado,
  normalizarPolyBase,
  type GeomKind,
} from "./geofence-editor";
import { isLocalId } from "../data/local-store";
import {
  COLOR_KEY,
  FORM_VACIO,
  INNER_KEY,
  PARENT_KEY,
  type FormLugar,
  type InnerGeofence,
  type LatLon,
  type Lugar,
} from "../places.types";
import { textosLugares, type TextosLugares } from "../i18n/places-i18n";

export const INNER_COLOR_DEF = "#1C64F2";

export function colorInner(inner: InnerGeofence): string {
  return inner.color || INNER_COLOR_DEF;
}

export function parentPlaceId(l: Lugar): string | null {
  const id = l.metadata?.[PARENT_KEY];
  return id || null;
}

export function innerEnEdicion(form: FormLugar): InnerGeofence | undefined {
  return form.inners.find((i) => i.id === form.innerEditId);
}

export function padreTieneGeometria(form: FormLugar): boolean {
  if (form.geom === "circle") return form.lat != null && form.lon != null;
  return form.vertices.length >= 3;
}

export function puntoEnPoligono(p: LatLon, vertices: LatLon[]): boolean {
  if (vertices.length < 3) return false;
  const [py, px] = p;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const vi = vertices[i];
    const vj = vertices[j];
    if (!vi || !vj) continue;
    const [yi, xi] = vi;
    const [yj, xj] = vj;
    const cruza = yi > py !== yj > py;
    if (!cruza) continue;
    const xInter = ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (px < xInter) inside = !inside;
  }
  return inside;
}

export function puntoDentroDelPadre(form: FormLugar, p: LatLon): boolean {
  if (form.geom === "circle") {
    if (form.lat == null || form.lon == null) return false;
    return distanciaM([form.lat, form.lon], p) <= form.radius_m;
  }
  return puntoEnPoligono(p, form.vertices);
}

/** Ancho y alto (m) de la geocerca: el diámetro de su círculo o la caja de su polígono. */
function medidasDelPadre(
  form: FormLugar
): { ancho: number; alto: number } | null {
  if (!padreTieneGeometria(form)) return null;
  if (form.geom === "circle") {
    const diametro = 2 * form.radius_m;
    return { ancho: diametro, alto: diametro };
  }
  const lats = form.vertices.map(([lat]) => lat);
  const lons = form.vertices.map(([, lon]) => lon);
  const sur = Math.min(...lats);
  const norte = Math.max(...lats);
  const oeste = Math.min(...lons);
  const este = Math.max(...lons);
  const medio = (sur + norte) / 2;
  return {
    ancho: distanciaM([medio, oeste], [medio, este]),
    alto: distanciaM([sur, oeste], [norte, oeste]),
  };
}

const mitad = (m: number) => Math.max(INNER_RADIO_MIN, Math.round(m / 2));

/**
 * Una geocerca interior nueva, de la mitad del tamaño de su geocerca: así cabe
 * dentro en vez de taparla. Sin la forma de la geocerca, las medidas fijas.
 */
export function nuevoInner(padre?: FormLugar): InnerGeofence {
  const medidas = padre ? medidasDelPadre(padre) : null;
  const lado = medidas ? Math.min(medidas.ancho, medidas.alto) : null;
  return {
    id: `local-inner-${crypto.randomUUID()}`,
    name: "",
    external_id: "",
    geom: "circle",
    lat: null,
    lon: null,
    radius_m: lado ? mitad(lado / 2) : INNER_RADIO_DEFAULT,
    vertices: [],
    cerrado: false,
    color: INNER_COLOR_DEF,
    polyBase: "libre",
    rectVinculado: false,
    rect_w_m: medidas ? mitad(medidas.ancho) : INNER_RECT_W_DEF,
    rect_h_m: medidas ? mitad(medidas.alto) : INNER_RECT_H_DEF,
  };
}

/**
 * El External ID que se le propone a una interior nueva: el de su geocerca con
 * el siguiente número libre entre sus interiores (SCL → SCL-1, SCL-2, …). Sin el
 * de la geocerca no se propone nada. Se puede cambiar antes de guardar.
 */
export function codigoSugerido(
  codigoPadre: string,
  inners: readonly Pick<InnerGeofence, "external_id">[]
): string {
  const base = codigoPadre.trim();
  if (!base) return "";
  const prefijo = `${base.toLowerCase()}-`;
  let mayor = 0;
  for (const inner of inners) {
    const codigo = (inner.external_id ?? "").trim().toLowerCase();
    if (!codigo.startsWith(prefijo)) continue;
    const resto = codigo.slice(prefijo.length);
    if (/^\d+$/.test(resto)) mayor = Math.max(mayor, Number(resto));
  }
  return `${base}-${mayor + 1}`;
}

/**
 * Cambia el External ID de la geocerca y, con él, el de las interiores que aún
 * llevan el propuesto (SCL-1 pasa a PLT-1 si SCL pasa a PLT). Las que se
 * escribieron a mano quedan como están. Solo pasa antes de guardar la geocerca:
 * guardada, su código ya no cambia.
 */
export function conCodigoPadre(form: FormLugar, codigo: string): FormLugar {
  const anterior = form.external_id.trim();
  const nuevo = codigo.trim();
  const prefijo = `${anterior.toLowerCase()}-`;
  const propuesto = (c: string) =>
    !!anterior &&
    c.toLowerCase().startsWith(prefijo) &&
    /^\d+$/.test(c.slice(prefijo.length));
  const inners = form.inners.map((inner) => {
    const actual = (inner.external_id ?? "").trim();
    if (!propuesto(actual)) return inner;
    const numero = actual.slice(prefijo.length);
    return { ...inner, external_id: nuevo ? `${nuevo}-${numero}` : "" };
  });
  return { ...form, external_id: codigo, inners };
}

export function innerComoForm(inner: InnerGeofence): FormLugar {
  return {
    ...FORM_VACIO,
    name: inner.name,
    geom: inner.geom,
    lat: inner.lat,
    lon: inner.lon,
    radius_m: inner.radius_m,
    vertices: inner.vertices,
    cerrado: inner.cerrado,
    polyBase: normalizarPolyBase(inner.polyBase),
    rectVinculado: esRectVinculado(inner),
    rect_w_m: inner.rect_w_m ?? INNER_RECT_W_DEF,
    rect_h_m: inner.rect_h_m ?? INNER_RECT_H_DEF,
  };
}

export function formComoInner(
  inner: InnerGeofence,
  f: FormLugar
): InnerGeofence {
  return {
    ...inner,
    name: f.name || inner.name,
    geom: f.geom,
    lat: f.lat,
    lon: f.lon,
    radius_m: f.radius_m,
    vertices: f.vertices,
    cerrado: f.cerrado,
    color: colorInner(inner),
    polyBase: f.polyBase,
    rectVinculado: f.rectVinculado,
    rect_w_m: f.rect_w_m,
    rect_h_m: f.rect_h_m,
  };
}

export function aplicarInnerRectangulo(inner: InnerGeofence): InnerGeofence {
  return formComoInner(inner, aplicarFormaBase(innerComoForm(inner)));
}

export function aplicarInnerGeomKind(
  inner: InnerGeofence,
  kind: GeomKind
): InnerGeofence {
  return formComoInner(inner, aplicarGeomKind(innerComoForm(inner), kind));
}

export function actualizarInner(
  form: FormLugar,
  innerId: string,
  updater: (innerForm: FormLugar) => FormLugar
): FormLugar {
  const inner = form.inners.find((i) => i.id === innerId);
  if (!inner) return form;
  const next = formComoInner(inner, updater(innerComoForm(inner)));
  return {
    ...form,
    inners: form.inners.map((i) => (i.id === innerId ? next : i)),
  };
}

function innerTieneGeometria(inner: InnerGeofence): boolean {
  if (inner.geom === "circle") return inner.lat != null && inner.lon != null;
  return inner.vertices.length >= 3;
}

export function innerEsBorradorVacio(inner: InnerGeofence): boolean {
  return (
    !inner.name.trim() &&
    !(inner.external_id ?? "").trim() &&
    !innerTieneGeometria(inner)
  );
}

export type FaltantesLugar = {
  name: boolean;
  ubicacion: boolean;
  geometria: boolean;
  /** El External ID (el de la geocerca lo marca su propio campo). */
  codigo?: boolean;
};

export const SIN_FALTANTES: FaltantesLugar = {
  name: false,
  ubicacion: false,
  geometria: false,
};

export function faltantesPadre(form: FormLugar): FaltantesLugar {
  const name = !form.name.trim();
  if (form.geom === "circle") {
    return { name, ubicacion: form.lat == null, geometria: false };
  }
  if (normalizarPolyBase(form.polyBase) === "libre") {
    return { name, ubicacion: false, geometria: form.vertices.length < 3 };
  }
  return { name, ubicacion: form.lat == null, geometria: false };
}

export function hayFaltantes(f: FaltantesLugar): boolean {
  return f.name || f.ubicacion || f.geometria || !!f.codigo;
}

export function mensajePadreIncompleto(
  form: FormLugar,
  t: TextosLugares = textosLugares()
): string | null {
  const f = faltantesPadre(form);
  if (f.name) return t("validation.name_missing");
  if (f.ubicacion) return t("validation.center_missing");
  if (f.geometria) return t("validation.polygon_vertices");
  return null;
}

export function faltantesInner(inner: InnerGeofence): FaltantesLugar {
  if (innerEsBorradorVacio(inner)) return SIN_FALTANTES;
  const name = !inner.name.trim();
  const codigo = !(inner.external_id ?? "").trim();
  if (inner.geom === "circle") {
    return { name, codigo, ubicacion: inner.lat == null, geometria: false };
  }
  if (normalizarPolyBase(inner.polyBase) === "libre") {
    return {
      name,
      codigo,
      ubicacion: false,
      geometria: inner.vertices.length < 3,
    };
  }
  return { name, codigo, ubicacion: inner.lat == null, geometria: false };
}

export function mensajeInnerIncompleto(
  inner: InnerGeofence,
  t: TextosLugares = textosLugares()
): string | null {
  const f = faltantesInner(inner);
  const nombre = inner.name;
  if (f.name) return t("validation.inner_name_missing");
  if (f.codigo) return t("validation.inner_code_missing", { nombre });
  if (f.ubicacion) return t("validation.inner_place", { nombre });
  if (f.geometria) return t("validation.inner_vertices", { nombre });
  return null;
}

export function innersParaGuardar(inners: InnerGeofence[]): InnerGeofence[] {
  return inners.filter((i) => !innerEsBorradorVacio(i));
}

function esInnerGeofence(x: unknown): x is InnerGeofence {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" && (o.geom === "circle" || o.geom === "polygon")
  );
}

export function innersDesdeMetadata(
  metadata: Record<string, string> | null
): InnerGeofence[] {
  const raw = metadata?.[INNER_KEY];
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(esInnerGeofence).map((i) => ({
      ...i,
      color: colorInner(i),
    }));
  } catch {
    return [];
  }
}

export function innerDesdeLugar(l: Lugar): InnerGeofence {
  const polygon = l.geometry_type ? l.geometry_type === "polygon" : !!l.polygon;
  return {
    id: l.place_id,
    name: l.name,
    external_id: l.external_id ?? "",
    geom: polygon ? "polygon" : "circle",
    lat: l.center?.[0] ?? null,
    lon: l.center?.[1] ?? null,
    radius_m: l.radius_m ?? INNER_RADIO_DEFAULT,
    vertices: l.polygon ?? [],
    cerrado: polygon,
    color: l.metadata?.[COLOR_KEY] || l.color || INNER_COLOR_DEF,
  };
}

export function innersDelLugar(lugar: Lugar, todos: Lugar[]): InnerGeofence[] {
  const hijos = todos
    .filter((l) => parentPlaceId(l) === lugar.place_id)
    .map(innerDesdeLugar);
  const ids = new Set(hijos.map((i) => i.id));
  const extra = innersDesdeMetadata(lugar.metadata).filter(
    (i) => isLocalId(i.id) && !ids.has(i.id)
  );
  return [...hijos, ...extra];
}

export function lugarHijoDesdeInner(
  inner: InnerGeofence,
  parent: Lugar
): Lugar {
  const polygon = inner.geom === "polygon";
  return {
    place_id: inner.id,
    name: inner.name,
    address: null,
    category: parent.category,
    category_id: parent.category_id,
    geometry_type: inner.geom,
    color: colorInner(inner),
    center:
      inner.lat != null && inner.lon != null ? [inner.lat, inner.lon] : null,
    polygon: polygon ? inner.vertices : null,
    radius_m: polygon ? null : inner.radius_m,
    metadata: {
      [PARENT_KEY]: parent.place_id,
      [COLOR_KEY]: colorInner(inner),
    },
    icon: null,
    external_id: inner.external_id?.trim() || null,
    active_from: parent.active_from,
    active_until: parent.active_until,
  };
}

export function idsHijosDe(parentId: string, todos: Lugar[]): string[] {
  return todos
    .filter((l) => parentPlaceId(l) === parentId)
    .map((l) => l.place_id);
}
