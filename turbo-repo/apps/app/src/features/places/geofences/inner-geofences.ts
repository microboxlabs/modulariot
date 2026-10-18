import {
  INNER_RADIO_DEFAULT,
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

export function nuevoInner(): InnerGeofence {
  return {
    id: `local-inner-${crypto.randomUUID()}`,
    name: "",
    geom: "circle",
    lat: null,
    lon: null,
    radius_m: INNER_RADIO_DEFAULT,
    vertices: [],
    cerrado: false,
    color: INNER_COLOR_DEF,
    polyBase: "libre",
    rectVinculado: false,
    rect_w_m: INNER_RECT_W_DEF,
    rect_h_m: INNER_RECT_H_DEF,
  };
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
  return !inner.name.trim() && !innerTieneGeometria(inner);
}

export type FaltantesLugar = {
  name: boolean;
  ubicacion: boolean;
  geometria: boolean;
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
  return f.name || f.ubicacion || f.geometria;
}

export function mensajePadreIncompleto(form: FormLugar): string | null {
  const f = faltantesPadre(form);
  if (f.name) return "Falta el nombre.";
  if (f.ubicacion) return "Fija el centro con clic en el mapa.";
  if (f.geometria) return "El polígono necesita al menos 3 vértices.";
  return null;
}

export function faltantesInner(inner: InnerGeofence): FaltantesLugar {
  if (innerEsBorradorVacio(inner)) return SIN_FALTANTES;
  const name = !inner.name.trim();
  if (inner.geom === "circle") {
    return { name, ubicacion: inner.lat == null, geometria: false };
  }
  if (normalizarPolyBase(inner.polyBase) === "libre") {
    return { name, ubicacion: false, geometria: inner.vertices.length < 3 };
  }
  return { name, ubicacion: inner.lat == null, geometria: false };
}

export function mensajeInnerIncompleto(inner: InnerGeofence): string | null {
  const f = faltantesInner(inner);
  if (f.name) return "Cada geocerca interior necesita un nombre.";
  if (f.ubicacion) {
    return `Ubica «${inner.name}» con un clic dentro del lugar.`;
  }
  if (f.geometria) {
    return `El interior «${inner.name}» necesita al menos 3 vértices.`;
  }
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
    external_id: null,
    active_from: parent.active_from,
    active_until: parent.active_until,
  };
}

export function payloadInner(
  inner: InnerGeofence,
  parentId: string,
  form: FormLugar
): Record<string, unknown> {
  return {
    p_name: inner.name,
    p_geometry_type: inner.geom,
    p_category_id: form.category_id ? Number(form.category_id) : null,
    p_address: null,
    p_lat: inner.lat,
    p_lon: inner.lon,
    p_radius_m: inner.radius_m,
    p_vertices: inner.geom === "polygon" ? inner.vertices : null,
    p_metadata: {
      [PARENT_KEY]: parentId,
      [COLOR_KEY]: colorInner(inner),
    },
    p_external_id: null,
    p_actor: "app-settings",
  };
}

export function idsHijosDe(parentId: string, todos: Lugar[]): string[] {
  return todos
    .filter((l) => parentPlaceId(l) === parentId)
    .map((l) => l.place_id);
}
