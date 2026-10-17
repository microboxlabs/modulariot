// Ubicación de los badges de nombres en el mapa:
//
// 1. Sin solapes: a cada zoom, los badges que se pisarían se juntan en uno
//    solo con los nombres en lista (todos se ven; ninguno se oculta).
// 2. Atlas propios: las imágenes de los badges se ubican en atlas de tamaño
//    acotado (varias páginas si hace falta), con su mapa de posiciones.
import type { LatLon } from "../places.types";

/** Tamaño del mundo en píxeles a zoom 0 (teselas de Mapbox de 512). */
const MUNDO_PX = 512;

/** Posición en píxeles "del mundo" (Web Mercator) al zoom dado. */
export function pixelesMundo(
  [lat, lon]: LatLon,
  zoom: number
): [number, number] {
  const escala = MUNDO_PX * 2 ** zoom;
  const lat0 = Math.max(-85.05, Math.min(85.05, lat));
  const s = Math.sin((lat0 * Math.PI) / 180);
  const x = ((lon + 180) / 360) * escala;
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * escala;
  return [x, y];
}

export type MedidaBadge = {
  /** Ancho y alto en pantalla, en píxeles. */
  w: number;
  h: number;
  /** Desplazamiento vertical del centro respecto del ancla. */
  dy: number;
};

/** Badges a menos de esto en pantalla se juntan en un cluster. */
const HUELGO = 12;

type Rect = { x0: number; y0: number; x1: number; y1: number };

const seCruzan = (a: Rect, b: Rect) =>
  a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const unir = (a: Rect, b: Rect): Rect => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
});

/**
 * Agrupa los badges que se pisarían: cada grupo se muestra como un solo
 * badge con sus nombres en lista. Ninguno se oculta. Dentro de cada grupo el
 * orden es por `prioridad` (mayor primero); el primero da la posición.
 */
export function agruparSolapes<T extends { id: string; ancla: LatLon }>(
  items: T[],
  zoom: number,
  medida: (item: T) => MedidaBadge,
  prioridad: (item: T) => number
): T[][] {
  const orden = [...items].sort(
    (a, b) => prioridad(b) - prioridad(a) || a.id.localeCompare(b.id)
  );
  let grupos: { rect: Rect; miembros: T[] }[] = [];
  for (const item of orden) {
    const [x, y] = pixelesMundo(item.ancla, zoom);
    const { w, h, dy } = medida(item);
    const r: Rect = {
      x0: x - w / 2 - HUELGO / 2,
      x1: x + w / 2 + HUELGO / 2,
      y0: y + dy - h / 2 - HUELGO / 2,
      y1: y + dy + h / 2 + HUELGO / 2,
    };
    const g = grupos.find((otro) => seCruzan(otro.rect, r));
    if (g) {
      g.miembros.push(item);
      g.rect = unir(g.rect, r);
    } else grupos.push({ rect: r, miembros: [item] });
  }
  // un grupo que creció puede tocar a otro: se juntan hasta que no queden
  let junto = true;
  while (junto) {
    junto = false;
    const sig: typeof grupos = [];
    for (const g of grupos) {
      const otro = sig.find((x) => seCruzan(x.rect, g.rect));
      if (otro) {
        otro.miembros.push(...g.miembros);
        otro.rect = unir(otro.rect, g.rect);
        junto = true;
      } else sig.push(g);
    }
    grupos = sig;
  }
  return grupos.map((g) => g.miembros);
}

/** Tope del acercamiento al abrir un cluster (nivel de edificio). */
export const ZOOM_MAX_SEPARAR = 20;
const PASO_ZOOM = 0.25;

/**
 * Zoom justo para que un cluster se abra: el primero, desde el actual, en el
 * que sus miembros ya no van todos juntos. Si ni al tope se separan (están
 * en el mismo punto), el tope.
 */
export function zoomParaSeparar<T extends { id: string; ancla: LatLon }>(
  miembros: T[],
  zoomActual: number,
  medida: (item: T) => MedidaBadge,
  prioridad: (item: T) => number,
  zoomMax = ZOOM_MAX_SEPARAR
): number {
  for (let z = zoomActual + PASO_ZOOM; z < zoomMax; z += PASO_ZOOM) {
    if (agruparSolapes(miembros, z, medida, prioridad).length > 1) return z;
  }
  return zoomMax;
}

/** Centro de los anclas (para encuadrar un cluster al abrirlo). */
export function centroDeAnclas(items: { ancla: LatLon }[]): LatLon {
  const lats = items.map((i) => i.ancla[0]);
  const lons = items.map((i) => i.ancla[1]);
  return [
    (Math.min(...lats) + Math.max(...lats)) / 2,
    (Math.min(...lons) + Math.max(...lons)) / 2,
  ];
}

/** Ancho de cada atlas y alto máximo (holgado bajo el límite de las GPU). */
export const ATLAS_ANCHO = 2048;
export const ATLAS_ALTO_MAX = 4096;
/** Separación entre imágenes del atlas: el filtrado no mezcla vecinas. */
const HOLGURA_ATLAS = 4;

export type Pagina = {
  ancho: number;
  alto: number;
  posiciones: Record<
    string,
    { x: number; y: number; width: number; height: number }
  >;
};

/**
 * Ubica las imágenes en filas dentro de atlas de ATLAS_ANCHO; cuando una
 * página llegaría a ATLAS_ALTO_MAX, sigue en otra. Una imagen más ancha que
 * el atlas ensancha su página.
 */
export function empaquetarChips(
  chips: { key: string; width: number; height: number }[],
  ancho = ATLAS_ANCHO,
  altoMax = ATLAS_ALTO_MAX
): Pagina[] {
  const H = HOLGURA_ATLAS;
  const orden = [...chips].sort((a, b) => b.height - a.height);
  const paginas: Pagina[] = [];
  let actual: Pagina = { ancho, alto: 0, posiciones: {} };
  let x = H;
  let y = H;
  let altoFila = 0;
  const cerrar = () => {
    actual.alto = y + altoFila + H;
    paginas.push(actual);
  };
  for (const c of orden) {
    if (x + c.width + H > actual.ancho && x > H) {
      x = H;
      y += altoFila + H;
      altoFila = 0;
    }
    if (y + c.height + H > altoMax && y > H) {
      cerrar();
      actual = { ancho, alto: 0, posiciones: {} };
      x = H;
      y = H;
      altoFila = 0;
    }
    actual.ancho = Math.max(actual.ancho, c.width + 2 * H);
    actual.posiciones[c.key] = { x, y, width: c.width, height: c.height };
    x += c.width + H;
    altoFila = Math.max(altoFila, c.height);
  }
  if (Object.keys(actual.posiciones).length > 0) cerrar();
  return paginas;
}
