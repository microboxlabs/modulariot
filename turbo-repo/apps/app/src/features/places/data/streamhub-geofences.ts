// Geocercas de StreamHub (tabla `geofences`) como lugares de Lugares. Solo
// lectura: se cargan para verlas, buscarlas e ir a ellas; nada se escribe.
import type { StreamhubGeofenceRow } from "@/app/api/utils/pgrest-client";
import type { LatLon, Lugar } from "../places.types";

/** Prefijo de sus ids: no chocan con los de PT4 ni con los locales. */
export const PREFIJO_STREAMHUB = "streamhub-";

/** De dónde lee Lugares sus geocercas (la tabla `geofences` de StreamHub). */
export const URL_GEOCERCAS = "/app/api/places/geofences";

/** Una geocerca de StreamHub: se ve, se busca y se va a ella; no se edita. */
export const esDeStreamhub = (placeId: string | null | undefined) =>
  !!placeId?.startsWith(PREFIJO_STREAMHUB);

/**
 * Escribir en StreamHub aún no existe: los lugares que se crean o editan se
 * guardan de prueba en el navegador (ids "local-"), no en PT4, que ya no se
 * lee (lo guardado ahí no volvería a verse).
 */
export const LUGARES_EN_LOCAL = true;

/** Un texto de `properties`, si lo es y no está vacío. */
function texto(props: Record<string, unknown> | null, clave: string) {
  const v = props?.[clave];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Anillo [lon, lat] → vértices [lat, lon], sin repetir el punto de cierre. */
function verticesDeAnillo(anillo: [number, number][]): LatLon[] {
  const vs = anillo.map(([lon, lat]) => [lat, lon] as LatLon);
  const [primero] = vs;
  const ultimo = vs.at(-1);
  const cerrado =
    vs.length > 1 &&
    primero?.[0] === ultimo?.[0] &&
    primero?.[1] === ultimo?.[1];
  return cerrado ? vs.slice(0, -1) : vs;
}

const promedio = (vs: LatLon[]): LatLon => [
  vs.reduce((s, v) => s + v[0], 0) / vs.length,
  vs.reduce((s, v) => s + v[1], 0) / vs.length,
];

/**
 * Una fila de StreamHub como lugar: siempre polígono (los círculos ya vienen
 * como polígono). Sin forma usable (menos de 3 vértices) no hay lugar.
 */
export function lugarDesdeGeofence(
  row: StreamhubGeofenceRow,
  anillo: [number, number][] | null
): Lugar | null {
  const vertices = anillo ? verticesDeAnillo(anillo) : [];
  if (vertices.length < 3) return null;
  const nombre =
    row.geofence_name?.trim() ||
    row.client_geofence_id?.trim() ||
    `Geocerca ${row.geofence_id}`;
  return {
    place_id: `${PREFIJO_STREAMHUB}${row.geofence_id}`,
    name: nombre,
    address: texto(row.properties, "address"),
    category: texto(row.properties, "category"),
    category_id: null,
    geometry_type: "polygon",
    color: null,
    center: promedio(vertices),
    polygon: vertices,
    radius_m: null,
    metadata: null,
    external_id: row.client_geofence_id,
    active_from: null,
    active_until: null,
  };
}
