// Transiciones del dibujo/edición de polígono sobre el formulario de lugar.
// Puras para poder probarlas; la UI solo las aplica con setForm(fn).
//
// Historial por instantáneas: cada edición guarda los vértices previos en
// `pasado`; deshacer/rehacer mueven instantáneas entre `pasado` y `futuro`.
import type { FormLugar, LatLon } from "./places.types";

export const MIN_VERTICES = 3;
const MAX_HISTORIAL = 50;

/** Primer vértice como centro de referencia del lugar (p_lat/p_lon). */
const conCentro = (f: FormLugar, vertices: LatLon[]): FormLugar => ({
  ...f,
  vertices,
  lat: vertices[0]?.[0] ?? null,
  lon: vertices[0]?.[1] ?? null,
});

/** Aplica un cambio de vértices que se puede deshacer. */
const editar = (f: FormLugar, vertices: LatLon[]): FormLugar => ({
  ...conCentro(f, vertices),
  pasado: [...f.pasado, f.vertices].slice(-MAX_HISTORIAL),
  futuro: [],
});

/** Un polígono terminado que queda con menos del mínimo vuelve a dibujo. */
const ajustarCierre = (f: FormLugar): FormLugar =>
  f.cerrado && f.vertices.length < MIN_VERTICES ? { ...f, cerrado: false } : f;

export const puedeTerminar = (f: FormLugar) =>
  !f.cerrado && f.vertices.length >= MIN_VERTICES;
export const puedeDeshacer = (f: FormLugar) => f.pasado.length > 0;
export const puedeRehacer = (f: FormLugar) => f.futuro.length > 0;
/** Se puede eliminar un vértice: terminado no baja del mínimo. */
export const puedeEliminar = (f: FormLugar) =>
  !f.cerrado || f.vertices.length > MIN_VERTICES;

/** Clic en el mapa: agrega al final (solo mientras se dibuja). */
export function agregarVertice(f: FormLugar, p: LatLon): FormLugar {
  if (f.cerrado) return f;
  return editar(f, [...f.vertices, p]);
}

/** Inserta un vértice en la posición `i` (handle del punto medio de un lado). */
export function insertarVertice(f: FormLugar, i: number, p: LatLon): FormLugar {
  const vertices = [...f.vertices];
  vertices.splice(i, 0, p);
  return editar(f, vertices);
}

export function eliminarVertice(f: FormLugar, i: number): FormLugar {
  if (!puedeEliminar(f) || !f.vertices[i]) return f;
  return editar(
    f,
    f.vertices.filter((_, j) => j !== i)
  );
}

/** Guarda una instantánea antes de un arrastre (el arrastre en sí no la guarda). */
export const marcarHistorial = (f: FormLugar): FormLugar =>
  editar(f, f.vertices);

/** Durante un arrastre: sin historial (ya se marcó al empezar). */
export function moverVertice(f: FormLugar, i: number, p: LatLon): FormLugar {
  return conCentro(
    f,
    f.vertices.map((v, j) => (j === i ? p : v))
  );
}

export function reemplazarVertices(
  f: FormLugar,
  vertices: LatLon[]
): FormLugar {
  return conCentro(f, vertices);
}

export function deshacer(f: FormLugar): FormLugar {
  const previo = f.pasado[f.pasado.length - 1];
  if (!previo) return f;
  return ajustarCierre({
    ...conCentro(f, previo),
    pasado: f.pasado.slice(0, -1),
    futuro: [...f.futuro, f.vertices],
  });
}

export function rehacer(f: FormLugar): FormLugar {
  const siguiente = f.futuro[f.futuro.length - 1];
  if (!siguiente) return f;
  return ajustarCierre({
    ...conCentro(f, siguiente),
    pasado: [...f.pasado, f.vertices],
    futuro: f.futuro.slice(0, -1),
  });
}

export function terminar(f: FormLugar): FormLugar {
  return puedeTerminar(f) ? { ...f, cerrado: true } : f;
}

/** Borra todo el dibujo; se puede deshacer. */
export function cancelarDibujo(f: FormLugar): FormLugar {
  return { ...editar(f, []), cerrado: false };
}

export function seguirDibujando(f: FormLugar): FormLugar {
  return { ...f, cerrado: false };
}

/**
 * Lados del polígono como pares de índices [a, b]. Mientras se dibuja no
 * incluye el lado de cierre (último → primero).
 */
export function lados(f: FormLugar): [number, number][] {
  const n = f.vertices.length;
  if (n < 2) return [];
  const xs: [number, number][] = [];
  for (let i = 0; i < n - 1; i++) xs.push([i, i + 1]);
  if (f.cerrado && n >= MIN_VERTICES) xs.push([n - 1, 0]);
  return xs;
}

export const puntoMedio = ([a1, b1]: LatLon, [a2, b2]: LatLon): LatLon => [
  (a1 + a2) / 2,
  (b1 + b2) / 2,
];

/**
 * Vértices [lat, lon] → anillo GeoJSON [lon, lat] cerrado (el primer punto se
 * repite al final). Sin cerrar, Mapbox no dibuja el último lado del contorno.
 */
export function anilloGeoJSON(vertices: LatLon[]): [number, number][] {
  const ring = vertices.map(([la, lo]) => [lo, la] as [number, number]);
  const primero = ring[0];
  const ultimo = ring[ring.length - 1];
  if (
    primero &&
    ultimo &&
    (primero[0] !== ultimo[0] || primero[1] !== ultimo[1])
  )
    ring.push([primero[0], primero[1]]);
  return ring;
}
