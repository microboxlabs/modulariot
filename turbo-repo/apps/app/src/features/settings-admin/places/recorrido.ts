// Recorrido de un trayecto "por dirección": lista ordenada de puntos. El
// primero es el origen (A), el último el destino (B) y los del medio son
// paradas de paso. Transiciones puras; la página decide cuándo trazar.
import type { Sugerencia } from "./geocoding";
import type { FormTrayecto, LatLon, Parada } from "./places.types";

/** Directions acepta 25 coordenadas. */
export const MAX_PUNTOS = 25;
export const MIN_PUNTOS = 2;

let secuencia = 0;
export const nuevoPunto = (): Parada => ({
  id: `punto-${++secuencia}`,
  texto: "",
  punto: null,
});

/** Distintivo del punto según su posición: A, 1, 2, …, B. */
export function etiquetaPunto(
  i: number,
  total: number
): { letra: string; colorCls: string; label: string } {
  if (i === 0) return { letra: "A", colorCls: "bg-green-600", label: "Desde" };
  if (i === total - 1)
    return { letra: "B", colorCls: "bg-rose-600", label: "Hasta" };
  return {
    letra: String(i),
    colorCls: "bg-blue-600",
    label: `Parada ${i}`,
  };
}

const MAX_HISTORIAL = 50;

/**
 * Cualquier cambio del recorrido invalida la ruta calculada y vuelve al
 * borrador: la línea entre puntos hasta que se confirme otra vez.
 */
const invalidar = (t: FormTrayecto): FormTrayecto => ({
  ...t,
  pts: [],
  ajustado: false,
  confirmado: false,
});

/** Cambio que se puede deshacer: guarda el recorrido previo. */
const editar = (t: FormTrayecto, recorrido: Parada[]): FormTrayecto =>
  invalidar({
    ...t,
    recorrido,
    pasado: [...t.pasado, t.recorrido].slice(-MAX_HISTORIAL),
    futuro: [],
  });

/**
 * Puntos en orden cuando el recorrido está completo: al menos dos direcciones
 * elegidas y ninguna escrita sin elegir. Los puntos vacíos se ignoran.
 */
export function puntosRecorrido(t: FormTrayecto): LatLon[] | null {
  const pts: LatLon[] = [];
  for (const p of t.recorrido) {
    if (p.punto) pts.push(p.punto);
    else if (p.texto.trim()) return null;
  }
  return pts.length >= MIN_PUNTOS ? pts : null;
}

/** Agrega un punto vacío antes del destino; luego se arrastra a su lugar. */
export function agregarPunto(t: FormTrayecto): FormTrayecto {
  if (t.recorrido.length >= MAX_PUNTOS) return t;
  const xs = [...t.recorrido];
  xs.splice(Math.max(xs.length - 1, 0), 0, nuevoPunto());
  return { ...t, recorrido: xs };
}

export function quitarPunto(t: FormTrayecto, id: string): FormTrayecto {
  if (t.recorrido.length <= MIN_PUNTOS) return t;
  return editar(
    t,
    t.recorrido.filter((p) => p.id !== id)
  );
}

/** Nuevo orden por ids (arrastrar y soltar). Mismo orden = sin cambio. */
export function reordenar(t: FormTrayecto, ids: string[]): FormTrayecto {
  if (ids.join() === t.recorrido.map((p) => p.id).join()) return t;
  const porId = new Map(t.recorrido.map((p) => [p.id, p]));
  const recorrido = ids.flatMap((id) => {
    const p = porId.get(id);
    return p ? [p] : [];
  });
  if (recorrido.length !== t.recorrido.length) return t;
  return editar(t, recorrido);
}

export function textoPunto(
  t: FormTrayecto,
  id: string,
  texto: string
): FormTrayecto {
  const recorrido = t.recorrido.map((p) =>
    p.id === id ? { ...p, texto, punto: null } : p
  );
  // solo borrar un punto ubicado entra al historial, no cada tecla
  const ubicado = t.recorrido.some((p) => p.id === id && p.punto);
  return ubicado ? editar(t, recorrido) : invalidar({ ...t, recorrido });
}

export function elegirPunto(
  t: FormTrayecto,
  id: string,
  s: Sugerencia
): FormTrayecto {
  return editar(
    t,
    t.recorrido.map((p) =>
      p.id === id ? { ...p, texto: s.nombre, punto: s.punto } : p
    )
  );
}

export function textoDesdeCoords(punto: LatLon): string {
  return `${punto[0].toFixed(5)}, ${punto[1].toFixed(5)}`;
}

/** Recorre waypoints guardados como filas del formulario A → B. */
export function recorridoDesdePts(pts: LatLon[]): Parada[] {
  if (pts.length === 0) {
    return [
      { id: "origen", texto: "", punto: null },
      { id: "destino", texto: "", punto: null },
    ];
  }
  if (pts.length === 1) {
    const origen = pts[0]!;
    return [
      { id: "origen", texto: textoDesdeCoords(origen), punto: origen },
      { id: "destino", texto: "", punto: null },
    ];
  }
  return pts.map((punto, i) => ({
    id: i === 0 ? "origen" : i === pts.length - 1 ? "destino" : `wp-${i}`,
    texto: textoDesdeCoords(punto),
    punto,
  }));
}

/** Ubica un punto del recorrido con un clic en el mapa. */
export function puntoDesdeMapa(
  t: FormTrayecto,
  id: string,
  punto: LatLon,
  texto: string
): FormTrayecto {
  return editar(
    t,
    t.recorrido.map((p) => (p.id === id ? { ...p, texto, punto } : p))
  );
}

/** Actualiza el rótulo (p. ej. reverse geocode) sin invalidar la ruta. */
export function rotularPunto(
  t: FormTrayecto,
  id: string,
  texto: string
): FormTrayecto {
  return {
    ...t,
    recorrido: t.recorrido.map((p) => (p.id === id ? { ...p, texto } : p)),
  };
}

// ── Edición sobre el mapa: borrador (línea), historial y confirmación ──

/** Puntos ya ubicados, en orden: la línea del borrador. */
export const puntosUbicados = (t: FormTrayecto): LatLon[] =>
  t.recorrido.flatMap((p) => (p.punto ? [p.punto] : []));

/** Primer punto sin ubicar: lo llena un clic en el mapa mientras se dibuja. */
export function primerPuntoVacio(t: FormTrayecto): string | null {
  if (t.confirmado) return null;
  return t.recorrido.find((p) => !p.punto)?.id ?? null;
}

export type Tramo = {
  /** Índice del recorrido donde se inserta una parada en este tramo. */
  indice: number;
  desde: LatLon;
  hasta: LatLon;
  medio: LatLon;
};

/** Tramos entre puntos ubicados consecutivos (los vacíos se saltan). */
export function tramosRecorrido(t: FormTrayecto): Tramo[] {
  const xs: Tramo[] = [];
  let previo: LatLon | null = null;
  t.recorrido.forEach((p, i) => {
    if (!p.punto) return;
    if (previo) {
      xs.push({
        indice: i,
        desde: previo,
        hasta: p.punto,
        medio: [(previo[0] + p.punto[0]) / 2, (previo[1] + p.punto[1]) / 2],
      });
    }
    previo = p.punto;
  });
  return xs;
}

type Px = [number, number];

/**
 * Punto de la línea más cercano al cursor, en píxeles de pantalla. `null` si
 * el cursor está lejos (más de `radio`) o pegado a un extremo (menos de
 * `margen`): ahí manda el punto existente, no una parada nueva.
 */
export function puntoSobreLinea(
  cursor: Px,
  tramos: { indice: number; a: Px; b: Px }[],
  radio = 12,
  margen = 14
): { indice: number; punto: Px } | null {
  let mejor: { indice: number; punto: Px; d: number } | null = null;
  for (const { indice, a, b } of tramos) {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const largo2 = dx * dx + dy * dy;
    const u =
      largo2 === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((cursor[0] - a[0]) * dx + (cursor[1] - a[1]) * dy) / largo2
            )
          );
    const punto: Px = [a[0] + u * dx, a[1] + u * dy];
    const d = Math.hypot(cursor[0] - punto[0], cursor[1] - punto[1]);
    if (d > radio || (mejor && d >= mejor.d)) continue;
    const cercaExtremo =
      Math.hypot(punto[0] - a[0], punto[1] - a[1]) < margen ||
      Math.hypot(punto[0] - b[0], punto[1] - b[1]) < margen;
    if (!cercaExtremo) mejor = { indice, punto, d };
  }
  return mejor && { indice: mejor.indice, punto: mejor.punto };
}

/** Inserta una parada ya ubicada en la posición `i` (punto medio de un tramo). */
export function insertarParada(
  t: FormTrayecto,
  i: number,
  parada: Parada
): FormTrayecto {
  if (t.recorrido.length >= MAX_PUNTOS) return t;
  const xs = [...t.recorrido];
  xs.splice(i, 0, parada);
  return editar(t, xs);
}

/** Guarda una instantánea antes de un arrastre (el arrastre en sí no la guarda). */
export const marcarHistorialRecorrido = (t: FormTrayecto): FormTrayecto =>
  editar(t, t.recorrido);

/** Durante un arrastre: sin historial (ya se marcó al empezar). */
export function moverPunto(
  t: FormTrayecto,
  id: string,
  punto: LatLon
): FormTrayecto {
  return invalidar({
    ...t,
    recorrido: t.recorrido.map((p) =>
      p.id === id ? { ...p, punto, texto: textoDesdeCoords(punto) } : p
    ),
  });
}

export const puedeDeshacerRecorrido = (t: FormTrayecto) => t.pasado.length > 0;
export const puedeRehacerRecorrido = (t: FormTrayecto) => t.futuro.length > 0;
export const puedeConfirmar = (t: FormTrayecto) =>
  !t.confirmado && puntosRecorrido(t) !== null;

export function deshacerRecorrido(t: FormTrayecto): FormTrayecto {
  const previo = t.pasado[t.pasado.length - 1];
  if (!previo) return t;
  return invalidar({
    ...t,
    recorrido: previo,
    pasado: t.pasado.slice(0, -1),
    futuro: [...t.futuro, t.recorrido],
  });
}

export function rehacerRecorrido(t: FormTrayecto): FormTrayecto {
  const siguiente = t.futuro[t.futuro.length - 1];
  if (!siguiente) return t;
  return invalidar({
    ...t,
    recorrido: siguiente,
    pasado: [...t.pasado, t.recorrido],
    futuro: t.futuro.slice(0, -1),
  });
}

/** Listo: se traza la ruta por los puntos. */
export const confirmarRecorrido = (t: FormTrayecto): FormTrayecto =>
  puedeConfirmar(t) ? { ...t, confirmado: true } : t;

/** Vuelve al borrador para mover puntos o agregar paradas. */
export const editarRecorrido = (t: FormTrayecto): FormTrayecto =>
  t.confirmado ? invalidar(t) : t;

/** Borra todos los puntos; se puede deshacer. */
export function borrarRecorrido(t: FormTrayecto): FormTrayecto {
  if (!t.recorrido.some((p) => p.punto || p.texto)) return t;
  return editar(t, recorridoDesdePts([]));
}
