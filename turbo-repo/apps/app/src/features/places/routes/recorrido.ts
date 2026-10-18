// Recorrido de un trayecto "por dirección": lista ordenada de puntos. El
// primero es el origen (A), el último el destino (B) y los del medio son
// paradas de paso. Transiciones puras; la página decide cuándo trazar.
import type { Sugerencia } from "../data/geocoding";
import type { FormTrayecto, LatLon, Parada, TipoPunto } from "../places.types";

/** Directions acepta 25 coordenadas. */
export const MAX_PUNTOS = 25;
export const MIN_PUNTOS = 2;

let secuencia = 0;
export const nuevoPunto = (): Parada => ({
  id: `punto-${++secuencia}`,
  texto: "",
  punto: null,
});

export type Distintivo = {
  /** "A", "B", el número de la parada o "" en un desvío. */
  letra: string;
  colorCls: string;
  label: string;
  /** Qué es el punto: origen, destino, parada o desvío (punto de paso). */
  rol: "origen" | "destino" | TipoPunto;
};

/**
 * Distintivo de cada punto: A, las paradas numeradas en orden (1, 2, …; los
 * desvíos no cuentan, van sin número) y B.
 */
export function distintivos(recorrido: Parada[]): Distintivo[] {
  const ultimo = recorrido.length - 1;
  let paradas = 0;
  let desvios = 0;
  return recorrido.map((p, i): Distintivo => {
    if (i === 0)
      return {
        letra: "A",
        colorCls: "bg-green-600",
        label: "Desde",
        rol: "origen",
      };
    if (i === ultimo)
      return {
        letra: "B",
        colorCls: "bg-rose-600",
        label: "Hasta",
        rol: "destino",
      };
    if (tipoDe(p) === "desvio") {
      desvios += 1;
      return {
        letra: "",
        colorCls: "",
        label: `Desvío ${desvios}`,
        rol: "desvio",
      };
    }
    paradas += 1;
    return {
      letra: String(paradas),
      colorCls: "bg-red-600",
      label: `Parada ${paradas}`,
      rol: "parada",
    };
  });
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

const RADIO_TIERRA_M = 6_371_000;

/** Largo de un camino [lat, lon][] en metros (suma de tramos, haversine). */
export function longitudM(pts: LatLon[]): number {
  const rad = Math.PI / 180;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const [la1, lo1] = pts[i - 1]!;
    const [la2, lo2] = pts[i]!;
    const a =
      Math.sin(((la2 - la1) * rad) / 2) ** 2 +
      Math.cos(la1 * rad) *
        Math.cos(la2 * rad) *
        Math.sin(((lo2 - lo1) * rad) / 2) ** 2;
    total += 2 * RADIO_TIERRA_M * Math.asin(Math.sqrt(a));
  }
  return total;
}

/** "850 m" o "12,4 km". */
export function textoDistancia(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km.toLocaleString("es-CL", { maximumFractionDigits: km < 100 ? 1 : 0 })} km`;
}

export function textoDesdeCoords(punto: LatLon): string {
  return `${punto[0].toFixed(5)}, ${punto[1].toFixed(5)}`;
}

/** Tipo de un punto; por defecto, parada. */
export const tipoDe = (p: Parada): TipoPunto => p.tipo ?? "parada";

/** Cambia el tipo sin tocar la geometría: la ruta trazada sigue valiendo. */
export function cambiarTipoPunto(
  t: FormTrayecto,
  id: string,
  tipo: TipoPunto
): FormTrayecto {
  return {
    ...t,
    recorrido: t.recorrido.map((p) => (p.id === id ? { ...p, tipo } : p)),
  };
}

/**
 * Parámetro `waypoints` de Mapbox Directions: índices de los puntos que son
 * paradas (más el origen y el destino). Los demás, los desvíos, quedan como
 * puntos de paso ("silent waypoints"): la ruta pasa por ahí sin parar.
 * `null` si todos son paradas (no hace falta el parámetro).
 */
export function waypointsDirections(tipos: TipoPunto[]): string | null {
  const ultimo = tipos.length - 1;
  const paradas = tipos.flatMap((t, i) =>
    i === 0 || i === ultimo || t === "parada" ? [i] : []
  );
  return paradas.length === tipos.length ? null : paradas.join(";");
}

/** Categoría de un punto: no cambia la geometría ni la ruta trazada. */
export function cambiarCategoriaPunto(
  t: FormTrayecto,
  id: string,
  categoria: string | undefined
): FormTrayecto {
  return {
    ...t,
    recorrido: t.recorrido.map((p) => {
      if (p.id !== id) return p;
      if (categoria) return { ...p, categoria };
      const sin = { ...p };
      delete sin.categoria;
      return sin;
    }),
  };
}

/** Categorías de los puntos ubicados, en el orden de los waypoints. */
export const categoriasUbicadas = (t: FormTrayecto): (string | null)[] =>
  t.recorrido.filter((p) => p.punto).map((p) => p.categoria ?? null);

/** Tipos de los puntos ubicados, en el orden de los waypoints guardados. */
export const tiposUbicados = (t: FormTrayecto): TipoPunto[] =>
  t.recorrido.filter((p) => p.punto).map(tipoDe);

/** Recorre waypoints guardados como filas del formulario A → B. */
/** A es "origen", B es "destino" y los de en medio, "wp-1", "wp-2"… */
function idDePunto(i: number, total: number): string {
  if (i === 0) return "origen";
  return i === total - 1 ? "destino" : `wp-${i}`;
}

export function recorridoDesdePts(
  pts: LatLon[],
  tipos: TipoPunto[] = [],
  categorias: (string | null)[] = []
): Parada[] {
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
    id: idDePunto(i, pts.length),
    texto: textoDesdeCoords(punto),
    punto,
    ...(tipos[i] ? { tipo: tipos[i] } : {}),
    ...(categorias[i] ? { categoria: categorias[i] } : {}),
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
  const previo = t.pasado.at(-1);
  if (!previo) return t;
  return invalidar({
    ...t,
    recorrido: previo,
    pasado: t.pasado.slice(0, -1),
    futuro: [...t.futuro, t.recorrido],
  });
}

export function rehacerRecorrido(t: FormTrayecto): FormTrayecto {
  const siguiente = t.futuro.at(-1);
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
