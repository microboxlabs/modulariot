export type LatLon = [number, number];

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
};
export type Stop = {
  place_id: string;
  name: string | null;
  stop_kind: string;
  center: [number, number] | null;
};
export type Circuito = {
  route_id: string;
  name: string;
  via_label: string | null;
  cerrado: boolean;
  ajustado: boolean;
  path_points: [number, number][] | null;
  stops: Stop[];
};
export type Categoria = { category_id: number; name: string; color: string };

export const FORM_VACIO = {
  place_id: null as string | null,
  name: "",
  icon: "",
  category_id: "",
  address: "",
  external_id: "",
  radius_m: 250,
  lat: null as number | null,
  lon: null as number | null,
  geom: "circle" as "circle" | "polygon",
  vertices: [] as LatLon[],
  /** Polígono terminado: los clics en el mapa ya no agregan vértices. */
  cerrado: false,
  /** Historial de edición del polígono: instantáneas de `vertices`. */
  pasado: [] as LatLon[][],
  futuro: [] as LatLon[][],
  metadata: [] as { k: string; v: string }[],
  active_from: "",
  active_until: "",
};
export type FormLugar = typeof FORM_VACIO;

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
  /** Cómo se define el recorrido: clics en el mapa o direcciones A → B. */
  metodo: "manual" as MetodoTrayecto,
  /** Puntos en orden: primero = origen (A), último = destino (B). */
  recorrido: [
    { id: "origen", texto: "", punto: null },
    { id: "destino", texto: "", punto: null },
  ] as Parada[],
};
export type FormTrayecto = typeof TRAY_VACIO;
export type MetodoTrayecto = "manual" | "direccion";
export type Parada = { id: string; texto: string; punto: LatLon | null };

export const MAX_METADATA = 10;
/** Clave reservada de metadata donde se guarda el icono del lugar. */
export const ICON_KEY = "_icon";

/** Filas del formulario → objeto metadata (sin filas vacías), con el icono. */
export function metadataParaGuardar(form: FormLugar): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { k, v } of form.metadata) {
    const key = k.trim();
    if (key && key !== ICON_KEY) out[key] = v.trim();
  }
  if (form.icon) out[ICON_KEY] = form.icon;
  return out;
}

/** metadata del lugar → filas editables (sin la clave reservada del icono). */
export function metadataAFilas(
  metadata: Record<string, string> | null
): { k: string; v: string }[] {
  return Object.entries(metadata ?? {})
    .filter(([k]) => k !== ICON_KEY)
    .map(([k, v]) => ({ k, v: String(v) }));
}

export const iconoDeLugar = (l: Lugar): string =>
  l.icon ?? l.metadata?.[ICON_KEY] ?? "";
