// Geocercas de StreamHub (tabla `geofences`) como lugares de Lugares. Solo
// lectura: se cargan para verlas, buscarlas e ir a ellas; nada se escribe.
// Llegan del modulith (miot-places, `/api/v1/orgs/{org}/places/geofences`).
import { z } from "zod";
import type { LatLon, Lugar } from "../places.types";

/** Un punto GeoJSON [lon, lat] (una Z, si la hay, se acepta y se descarta). */
const punto = z.array(z.number()).min(2);
const anillo = z.array(punto);

/**
 * La forma de la geocerca: Polygon o MultiPolygon. Otra geometría, o una mal
 * formada, queda en null y la geocerca se descarta sin botar las demás.
 */
const forma = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("Polygon"), coordinates: z.array(anillo) }),
    z.object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(z.array(anillo)),
    }),
  ])
  .nullable()
  .catch(null);

/** Una geocerca como la sirve miot-places (`/places/geofences`). */
export const geocercaModulithSchema = z.object({
  id: z.number(),
  /** El id que el cliente le da a la geocerca. */
  code: z.string().nullable(),
  name: z.string().nullable(),
  polygonType: z.string().nullable(),
  /** La columna `geofence_category`; null donde aún no existe. */
  category: z.string().nullable(),
  shape: forma,
  /** JSON libre: `address`, `radius_meters`, … */
  properties: z.record(z.string(), z.unknown()).nullable().catch(null),
});

export type GeocercaModulith = z.infer<typeof geocercaModulithSchema>;

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

/**
 * La categoría de la geocerca: solo la columna `geofence_category`. Sin valor
 * (o mientras la columna no exista) no hay categoría: «sin categoría».
 */
function categoriaDeGeofence(geocerca: GeocercaModulith) {
  return geocerca.category?.trim() || null;
}

/** El primer polígono de la forma (MultiPolygon → su primer polígono). */
function primerPoligono(shape: GeocercaModulith["shape"]) {
  if (!shape) return undefined;
  if (shape.type === "MultiPolygon") return shape.coordinates[0];
  return shape.coordinates;
}

/** Anillo exterior [lon, lat] de la forma; null si no tiene. */
export function anilloExterior(
  shape: GeocercaModulith["shape"]
): [number, number][] | null {
  const exterior = primerPoligono(shape)?.[0];
  if (!exterior) return null;
  return exterior.map(([lon = Number.NaN, lat = Number.NaN]) => [lon, lat]);
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
 * Una geocerca de StreamHub como lugar: siempre polígono (los círculos ya
 * vienen como polígono). Sin forma usable (menos de 3 vértices) no hay lugar.
 */
export function lugarDesdeGeofence(geocerca: GeocercaModulith): Lugar | null {
  const anillo = anilloExterior(geocerca.shape);
  const vertices = anillo ? verticesDeAnillo(anillo) : [];
  if (vertices.length < 3) return null;
  const nombre =
    geocerca.name?.trim() || geocerca.code?.trim() || `Geocerca ${geocerca.id}`;
  return {
    place_id: `${PREFIJO_STREAMHUB}${geocerca.id}`,
    name: nombre,
    address: texto(geocerca.properties, "address"),
    category: categoriaDeGeofence(geocerca),
    category_id: null,
    geometry_type: "polygon",
    color: null,
    center: promedio(vertices),
    polygon: vertices,
    radius_m: null,
    metadata: null,
    external_id: geocerca.code,
    active_from: null,
    active_until: null,
  };
}
