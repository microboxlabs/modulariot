import type { MapRef } from "react-map-gl";
import type { LatLon } from "../places.types";

/** PlaceForm pasa `[lat, lon]`; el mapa necesita lat y lon sueltos. */
export function ubicarPuntoEnMapa(
  punto: LatLon,
  radioM: number,
  encuadrar: (lat: number, lon: number, radioM: number) => void
) {
  encuadrar(punto[0], punto[1], radioM);
}

/** [[lonMin, latMin], [lonMax, latMax]], como la pide Mapbox. */
export type Caja = [[number, number], [number, number]];
export type Margen = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};
type Camara = { centro: [number, number]; zoom: number };

export function cajaDePuntos(pts: LatLon[]): Caja {
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

/** Lo mínimo que debe quedar libre del mapa entre los márgenes. */
const LIBRE_MIN = 40;

/**
 * Márgenes que caben en el mapa: si a lo ancho (o alto) suman más que la
 * vista, se achican en proporción y dejan siempre un hueco libre.
 */
export function margenQueCabe(m: Margen, ancho: number, alto: number): Margen {
  const escala = (a: number, b: number, total: number) => {
    const max = Math.max(total - LIBRE_MIN, 0);
    return a + b > max && a + b > 0 ? max / (a + b) : 1;
  };
  const h = escala(m.left, m.right, ancho);
  const v = escala(m.top, m.bottom, alto);
  return {
    left: m.left * h,
    right: m.right * h,
    top: m.top * v,
    bottom: m.bottom * v,
  };
}

const finito = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

type CentroMapbox =
  | [number, number]
  | { lng: number; lat: number }
  | { lon: number; lat: number };

function lonLatDe(c: CentroMapbox): [number, number] {
  if (Array.isArray(c)) return c;
  return "lng" in c ? [c.lng, c.lat] : [c.lon, c.lat];
}

/** La cámara que propone Mapbox, solo si sus números son válidos. */
export function camaraValida(
  cam: { center?: CentroMapbox; zoom?: number } | undefined | null
): Camara | null {
  if (!cam?.center) return null;
  const centro = lonLatDe(cam.center);
  if (!centro.every(finito) || !finito(cam.zoom)) return null;
  return { centro, zoom: cam.zoom };
}

const TILE = 512;
const LAT_MAX = 85.0511;
const xMerc = (lon: number) => (lon + 180) / 360;
const yMerc = (lat: number) => {
  const r = (Math.max(-LAT_MAX, Math.min(LAT_MAX, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2;
};
const latDeY = (y: number) =>
  (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

/**
 * Cámara para una caja calculada en Mercator, sin Mapbox: el respaldo cuando
 * su cálculo en el globo falla (rutas entre continentes devuelven NaN).
 */
export function camaraMercator(
  caja: Caja,
  m: Margen,
  ancho: number,
  alto: number,
  maxZoom: number
): Camara {
  const [[lonMin, latMin], [lonMax, latMax]] = caja;
  const dx = xMerc(lonMax) - xMerc(lonMin);
  const dy = yMerc(latMin) - yMerc(latMax);
  const libreX = Math.max(ancho - m.left - m.right, 1);
  const libreY = Math.max(alto - m.top - m.bottom, 1);
  const zx = dx > 0 ? Math.log2(libreX / (TILE * dx)) : maxZoom;
  const zy = dy > 0 ? Math.log2(libreY / (TILE * dy)) : maxZoom;
  const zoom = Math.max(0, Math.min(maxZoom, zx, zy));
  // el centro de la caja, corrido para que quede en el hueco entre márgenes
  const mundo = TILE * 2 ** zoom;
  const x =
    (xMerc(lonMin) + xMerc(lonMax)) / 2 + (m.right - m.left) / 2 / mundo;
  const y =
    (yMerc(latMin) + yMerc(latMax)) / 2 + (m.bottom - m.top) / 2 / mundo;
  return {
    centro: [x * 360 - 180, latDeY(Math.max(0, Math.min(1, y)))],
    zoom,
  };
}

/**
 * Encuadra una caja dejando libres los márgenes. Usa el fitBounds de Mapbox
 * cuando su cámara es válida; si no (o si falla), una calculada aquí, así
 * nunca llega un centro NaN al mapa.
 */
export function encuadrarCaja(
  map: MapRef,
  caja: Caja,
  opciones: { margen: Margen; maxZoom: number; duration: number }
) {
  const el = map.getContainer();
  const ancho = el.clientWidth;
  const alto = el.clientHeight;
  const padding = margenQueCabe(opciones.margen, ancho, alto);
  const { maxZoom, duration } = opciones;
  let cam: Camara | null = null;
  try {
    cam = camaraValida(map.cameraForBounds(caja, { padding, maxZoom }));
  } catch {
    cam = null;
  }
  if (cam) {
    map.fitBounds(caja, { padding, maxZoom, duration });
    return;
  }
  const m = camaraMercator(caja, padding, ancho, alto, maxZoom);
  map.flyTo({ center: m.centro, zoom: m.zoom, duration });
}
