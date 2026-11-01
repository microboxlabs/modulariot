// Transiciones del dibujo/edición de polígono sobre el formulario de lugar.
// Puras para poder probarlas; la UI solo las aplica con setForm(fn).
//
// Historial por instantáneas: cada edición guarda los vértices previos en
// `pasado`; deshacer/rehacer mueven instantáneas entre `pasado` y `futuro`.
import type { LineString, Polygon } from "geojson";
import type { FormLugar, LatLon } from "../places.types";

export const MIN_VERTICES = 3;
const MAX_HISTORIAL = 50;

function centroDe(f: FormLugar, vertices: LatLon[]): LatLon | null {
  const first = vertices[0];
  if (!first) return null;
  if ((f.polyBase ?? "libre") === "libre" || vertices.length < 3) return first;
  const lat = vertices.reduce((s, v) => s + v[0], 0) / vertices.length;
  const lon = vertices.reduce((s, v) => s + v[1], 0) / vertices.length;
  return [lat, lon];
}

/** Arrastrar un vértice de una forma base la convierte en polígono libre. */
export function soltarComoPoligono(f: FormLugar): FormLugar {
  if (f.geom !== "polygon") return f;
  if ((f.polyBase ?? "libre") === "libre") return f;
  return { ...f, polyBase: "libre" };
}

/** Centro de referencia: primer vértice, o el centroide si es un rectángulo. */
const conCentro = (f: FormLugar, vertices: LatLon[]): FormLugar => {
  const c = centroDe(f, vertices);
  return {
    ...f,
    vertices,
    lat: c?.[0] ?? null,
    lon: c?.[1] ?? null,
  };
};

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
  return editar(soltarComoPoligono(f), vertices);
}

export function eliminarVertice(f: FormLugar, i: number): FormLugar {
  if (!puedeEliminar(f) || !f.vertices[i]) return f;
  return editar(
    soltarComoPoligono(f),
    f.vertices.filter((_, j) => j !== i)
  );
}

/** Guarda una instantánea antes de un arrastre (el arrastre en sí no la guarda). */
export const marcarHistorial = (f: FormLugar): FormLugar =>
  editar(f, f.vertices);

/** Durante un arrastre: sin historial (ya se marcó al empezar). */
export function moverVertice(f: FormLugar, i: number, p: LatLon): FormLugar {
  return conCentro(
    soltarComoPoligono(f),
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
  const previo = f.pasado.at(-1);
  if (!previo) return f;
  return ajustarCierre({
    ...conCentro(f, previo),
    pasado: f.pasado.slice(0, -1),
    futuro: [...f.futuro, f.vertices],
  });
}

export function rehacer(f: FormLugar): FormLugar {
  const siguiente = f.futuro.at(-1);
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

/**
 * Mientras se dibuja, soltar un extremo (primer o último vértice) sobre el
 * otro los une y cierra el polígono. Si al fundirlos quedarían menos del
 * mínimo, el extremo vuelve a `previo` (donde estaba antes de arrastrarlo) y
 * solo se cierra. El historial ya se marcó al empezar el arrastre.
 */
export function unirExtremos(
  f: FormLugar,
  i: number,
  previo: LatLon
): FormLugar {
  const n = f.vertices.length;
  if (f.cerrado || n < MIN_VERTICES || (i !== 0 && i !== n - 1)) return f;
  const vertices =
    n - 1 >= MIN_VERTICES
      ? f.vertices.filter((_, j) => j !== i)
      : f.vertices.map((v, j) => (j === i ? previo : v));
  return { ...conCentro(f, vertices), cerrado: true };
}

/** El extremo opuesto al vértice `i`, si `i` es un extremo de un trazo abierto. */
export function extremoOpuesto(f: FormLugar, i: number): number | null {
  const n = f.vertices.length;
  if (f.cerrado || n < MIN_VERTICES) return null;
  if (i === 0) return n - 1;
  if (i === n - 1) return 0;
  return null;
}

export function seguirDibujando(f: FormLugar): FormLugar {
  return { ...soltarComoPoligono(f), cerrado: false };
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
  const ultimo = ring.at(-1);
  if (
    primero &&
    ultimo &&
    (primero[0] !== ultimo[0] || primero[1] !== ultimo[1])
  )
    ring.push([primero[0], primero[1]]);
  return ring;
}

/**
 * Mientras se dibuja: trazo abierto. Al cerrar (clic en el primero): polígono.
 */
export function geometriaDibujo(
  vertices: LatLon[],
  cerrado: boolean
): Polygon | LineString | null {
  if (vertices.length < 2) return null;
  if (!cerrado) {
    return {
      type: "LineString",
      coordinates: vertices.map(([la, lo]) => [lo, la]),
    };
  }
  return {
    type: "Polygon",
    coordinates: [anilloGeoJSON(vertices)],
  };
}
