import { distanciaM } from "../geofences/geofence-editor";
import { centroide } from "./map-handles";
import type { Lugar } from "../places.types";

/** Metros por píxel en el ecuador a zoom 0 (Web Mercator, mundo de 512 px). */
const M_POR_PX_Z0 = 78_271.51696402048;
/** Evita que cos(lat) se vaya a 0 cerca de los polos. */
const COS_MIN = 0.05;

/**
 * Radio en pantalla del padre a partir del cual se “abre” el clúster
 * y pueden verse las geocercas interiores.
 */
export const PX_ABRIR_INTERIORES = 72;

function latDe(l: Pick<Lugar, "polygon" | "center">): number | null {
  if (l.polygon && l.polygon.length >= 3)
    return centroide(l.polygon)[0] ?? null;
  return l.center?.[0] ?? null;
}

/** Radio característico en metros: círculo o envolvente del polígono. */
export function radioLugarM(
  l: Pick<Lugar, "polygon" | "center" | "radius_m">
): number {
  if (l.polygon && l.polygon.length >= 3) {
    const c = centroide(l.polygon);
    let max = 0;
    for (const p of l.polygon) {
      max = Math.max(max, distanciaM(c, p));
    }
    return max;
  }
  return l.radius_m ?? 250;
}

/** Zoom al que un radio en metros ocupa `px` píxeles en esa latitud. */
export function zoomParaTamanoPx(
  radioM: number,
  lat: number,
  px: number
): number {
  if (radioM <= 0 || px <= 0) return 22;
  const cos = Math.max(COS_MIN, Math.cos((lat * Math.PI) / 180));
  return Math.log2((px * M_POR_PX_Z0 * cos) / radioM);
}

type GeomLugar = Pick<Lugar, "polygon" | "center" | "radius_m">;

export function zoomAbrirInteriores(padre: GeomLugar): number {
  const lat = latDe(padre);
  if (lat == null) return 22;
  return zoomParaTamanoPx(radioLugarM(padre), lat, PX_ABRIR_INTERIORES);
}

/** Datos mínimos para clústerizar un nombre (sin importar el chip). */
export type ItemNombreLod = {
  id: string;
  inner?: boolean;
  parentId?: string | null;
  ancla: [number, number];
  radio_m?: number;
  lugar?: GeomLugar;
};

function geomDeNombre(item: ItemNombreLod): GeomLugar {
  return {
    center: item.lugar?.center ?? item.ancla,
    polygon: item.lugar?.polygon ?? null,
    radius_m: item.radio_m ?? item.lugar?.radius_m ?? 250,
  };
}

/**
 * Clic en el padre agrupado → zoom que abre el clúster.
 * Clic en un nombre ya abierto → encuadra esa geocerca.
 */
export function zoomAlClicNombre(
  item: ItemNombreLod,
  zoomActual: number,
  todos: ItemNombreLod[]
): number {
  const geom = geomDeNombre(item);
  const lat = item.ancla[0];
  if (!item.inner) {
    const hijos = todos.filter((i) => i.inner && i.parentId === item.id);
    const zAbre = zoomAbrirInteriores(geom);
    if (hijos.length > 0 && zoomActual < zAbre) {
      return Math.min(20, zAbre + 0.4);
    }
  }
  return Math.min(
    20,
    Math.max(3, zoomParaTamanoPx(radioLugarM(geom), lat, 140))
  );
}
