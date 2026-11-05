import { z } from "zod";

export type LatLon = [number, number];

/** Cómo se dibuja el polígono: a mano o a partir de una forma base. */
export type PolyBase = "libre" | "rect" | "tri";

/** Zona más específica dentro de un lugar (lote en un estacionamiento, etc.). */
export type InnerGeofence = {
  id: string;
  name: string;
  geom: "circle" | "polygon";
  lat: number | null;
  lon: number | null;
  radius_m: number;
  vertices: LatLon[];
  cerrado: boolean;
  /** Hex de la geocerca en el mapa (por defecto el azul del sistema). */
  color: string;
  polyBase?: PolyBase | "cuadro";
  rectVinculado?: boolean;
  rect_w_m?: number;
  rect_h_m?: number;
};

export type Lugar = {
  place_id: string;
  name: string;
  address: string | null;
  category: string | null;
  category_id: number | null;
  geometry_type: string | null;
  color: string | null;
  center: [number, number] | null; // [lat, lon] (lab)
  polygon: [number, number][] | null;
  radius_m: number | null;
  metadata: Record<string, string> | null;
  external_id: string | null;
  active_from: string | null;
  active_until: string | null;
  /** Solo en respaldo local; en el servidor viaja en metadata[ICON_KEY]. */
  icon?: string | null;
};
export type Trayecto = {
  trayecto_id: string;
  name: string;
  kind: string;
  width_m: number | null;
  points: [number, number][];
  waypoints: [number, number][] | null;
  parent_name: string | null;
  ajustado: boolean | null;
  external_id: string | null;
  /** Solo se conserva en el respaldo local (el lab no tiene campo icono). */
  icon?: string | null;
  /** Igual que el icono: el servidor aún no tiene campo para categorías. */
  categorias?: string[] | null;
  /** Tipo de cada waypoint, en el mismo orden (también solo local). */
  tipos_puntos?: TipoPunto[] | null;
  /** Categoría de cada waypoint (null = sin categoría), también local. */
  categorias_puntos?: (string | null)[] | null;
};
export type Categoria = { category_id: number; name: string; color: string };

/**
 * Geocerca que no es de Lugares (p. ej. las del viaje): solo se lista para
 * verla e ir a ella. `ancla` es [lat, lon].
 */
export type GeocercaExterna = {
  id: string;
  nombre: string;
  /** Su papel, p. ej. "Origen del viaje". */
  detalle: string;
  ancla: LatLon;
};

export const FORM_VACIO = {
  place_id: null as string | null,
  name: "",
  icon: "",
  color: "",
  category_id: "",
  /** Categorías (códigos del seleccionable de categorías); se eligen varias. */
  categorias: [] as string[],
  address: "",
  external_id: "",
  radius_m: 20,
  lat: null as number | null,
  lon: null as number | null,
  geom: "circle" as "circle" | "polygon",
  polyBase: "libre" as PolyBase,
  rectVinculado: false,
  rect_w_m: 200,
  rect_h_m: 120,
  vertices: [] as LatLon[],
  /** Polígono terminado: los clics en el mapa ya no agregan vértices. */
  cerrado: false,
  /** Historial de edición del polígono: instantáneas de `vertices`. */
  pasado: [] as LatLon[][],
  futuro: [] as LatLon[][],
  metadata: [] as { k: string; v: string }[],
  active_from: "",
  active_until: "",
  inners: [] as InnerGeofence[],
  /** Geocerca interior que se está dibujando o ajustando en el mapa. */
  innerEditId: null as string | null,
  /** Texto de "Posicionar geocerca" (solo del formulario, no se guarda). */
  busqueda: "",
  /** Dirección elegida en esa búsqueda, mientras el centro siga ahí. */
  ubicadoEn: null as string | null,
};
export type FormLugar = typeof FORM_VACIO;

/** Paso del formulario de lugar: geocerca primero, interiores después. */
export type PasoLugar = "geocerca" | "interiores";

/** Paso del formulario de trayecto: recorrido primero, datos después. */
export type PasoTrayecto = "recorrido" | "datos";

export const TRAY_VACIO = {
  id: null as string | null,
  name: "",
  icon: "",
  kind: "vial" as "vial" | "interno",
  width_m: 30,
  external_id: "",
  pts: [] as LatLon[],
  ajustado: false,
  vias: [] as string[],
  /** Puntos en orden: primero = origen (A), último = destino (B). */
  recorrido: [
    { id: "origen", texto: "", punto: null },
    { id: "destino", texto: "", punto: null },
  ] as Parada[],
  /** Categorías (códigos del seleccionable de categorías), como en lugares. */
  categorias: [] as string[],
  /** Recorrido confirmado: se ve la ruta trazada; si no, la línea entre puntos. */
  confirmado: false,
  /** Historial del recorrido (deshacer/rehacer desde la barra del mapa). */
  pasado: [] as Parada[][],
  futuro: [] as Parada[][],
};
export type FormTrayecto = typeof TRAY_VACIO;
/** Qué es un punto intermedio: el vehículo se detiene o solo pasa (desvío). */
export type TipoPunto = "parada" | "desvio";
export type Parada = {
  id: string;
  texto: string;
  punto: LatLon | null;
  /** Solo puntos intermedios; sin valor = "parada". */
  tipo?: TipoPunto;
  /** Solo puntos intermedios: código del seleccionable de categoría. */
  categoria?: string;
};

/** Clave reservada de metadata donde se guarda el icono del lugar. */
export const ICON_KEY = "_icon";
/** Geocercas interiores serializadas en el lugar padre. */
export const INNER_KEY = "_inners";
/** En un lugar hijo, id del lugar que lo contiene. */
export const PARENT_KEY = "_parent_place_id";
/** Color propio de una geocerca (metadata del lugar). */
export const COLOR_KEY = "_color";
export const COLOR_LUGAR_DEF = "#1C64F2";
/** Categorías del lugar (códigos de un seleccionable), como arreglo JSON. */
export const CATEGORIAS_KEY = "_categorias";

const CLAVES_RESERVADAS = new Set([
  ICON_KEY,
  INNER_KEY,
  PARENT_KEY,
  COLOR_KEY,
  CATEGORIAS_KEY,
]);

const codigosSchema = z.array(z.string());

/** Categorías guardadas en la metadata del lugar; ilegibles = ninguna. */
export function categoriasDeLugar(l: Pick<Lugar, "metadata">): string[] {
  const raw = l.metadata?.[CATEGORIAS_KEY];
  if (!raw) return [];
  try {
    const parsed = codigosSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Filas del formulario → objeto metadata (sin filas vacías), con el icono. */
export function metadataParaGuardar(form: FormLugar): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { k, v } of form.metadata) {
    const key = k.trim();
    if (key && !CLAVES_RESERVADAS.has(key)) out[key] = v.trim();
  }
  if (form.icon) out[ICON_KEY] = form.icon;
  if (form.color) out[COLOR_KEY] = form.color;
  if (form.categorias.length > 0)
    out[CATEGORIAS_KEY] = JSON.stringify(form.categorias);
  if (form.inners.length > 0) out[INNER_KEY] = JSON.stringify(form.inners);
  return out;
}

/** metadata del lugar → filas editables (sin claves reservadas). */
export function metadataAFilas(
  metadata: Record<string, string> | null
): { k: string; v: string }[] {
  return Object.entries(metadata ?? {})
    .filter(([k]) => !CLAVES_RESERVADAS.has(k))
    .map(([k, v]) => ({ k, v: String(v) }));
}

export const iconoDeLugar = (l: Lugar): string =>
  l.icon ?? l.metadata?.[ICON_KEY] ?? "";

export const colorDeLugar = (l: Lugar, fallback = COLOR_LUGAR_DEF): string =>
  l.metadata?.[COLOR_KEY] || l.color || fallback;

export function colorDeFormLugar(
  form: FormLugar,
  cats: Categoria[] = []
): string {
  if (form.color) return form.color;
  const cat = cats.find((c) => String(c.category_id) === form.category_id);
  return cat?.color || COLOR_LUGAR_DEF;
}
