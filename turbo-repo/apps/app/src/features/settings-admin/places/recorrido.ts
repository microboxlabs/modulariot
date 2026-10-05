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
    colorCls: "bg-purple-600",
    label: `Parada ${i}`,
  };
}

/** Cualquier cambio del recorrido invalida la ruta calculada. */
const invalidar = (t: FormTrayecto): FormTrayecto => ({
  ...t,
  pts: [],
  ajustado: false,
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

/** Nombre sugerido: "primera → última" dirección elegida. */
export function nombreRecorrido(t: FormTrayecto): string {
  const elegidos = t.recorrido.filter((p) => p.punto);
  return `${elegidos[0]?.texto ?? ""} → ${elegidos[elegidos.length - 1]?.texto ?? ""}`;
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
  return invalidar({
    ...t,
    recorrido: t.recorrido.filter((p) => p.id !== id),
  });
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
  return invalidar({ ...t, recorrido });
}

export function textoPunto(
  t: FormTrayecto,
  id: string,
  texto: string
): FormTrayecto {
  return invalidar({
    ...t,
    recorrido: t.recorrido.map((p) =>
      p.id === id ? { ...p, texto, punto: null } : p
    ),
  });
}

export function elegirPunto(
  t: FormTrayecto,
  id: string,
  s: Sugerencia
): FormTrayecto {
  return invalidar({
    ...t,
    recorrido: t.recorrido.map((p) =>
      p.id === id ? { ...p, texto: s.nombre, punto: s.punto } : p
    ),
  });
}
