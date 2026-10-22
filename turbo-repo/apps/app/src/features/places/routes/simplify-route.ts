// Acorta una ruta pegada a calles sin sacarla de la calle: Douglas–Peucker
// quita los puntos de los tramos rectos y deja los de las curvas. Quitar
// uno de cada k puntos, en cambio, corta las curvas en línea recta.
import type { LatLon } from "../places.types";

const RADIO_TIERRA_M = 6_371_000;
const RAD = Math.PI / 180;

type Xy = [number, number];

/** Lo que importan los extremos: un número (no Infinity) para poder restarlo. */
const SIEMPRE = Number.MAX_VALUE;

/** A metros en un plano local: basta para distancias de unos cientos de km. */
function aPlano(pts: LatLon[]): Xy[] {
  const escalaLon = Math.cos((pts[0]?.[0] ?? 0) * RAD);
  return pts.map(([la, lo]) => [
    lo * RAD * RADIO_TIERRA_M * escalaLon,
    la * RAD * RADIO_TIERRA_M,
  ]);
}

/** Distancia de `p` al tramo a–b, en metros. */
function distanciaAlTramo(p: Xy, a: Xy, b: Xy): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const largo2 = dx * dx + dy * dy;
  const t =
    largo2 === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / largo2)
        );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/** El punto entre `desde` y `hasta` más lejos de su recta, y su distancia. */
function masLejano(xy: Xy[], desde: number, hasta: number) {
  let indice = -1;
  let maxima = 0;
  for (let i = desde + 1; i < hasta; i++) {
    const d = distanciaAlTramo(xy[i]!, xy[desde]!, xy[hasta]!);
    if (d > maxima) {
      maxima = d;
      indice = i;
    }
  }
  return { indice, maxima };
}

/**
 * Cuánto importa cada punto para la forma (Douglas–Peucker): la distancia a
 * la que dejaría de estar. Los extremos importan siempre (el máximo).
 */
function importancias(pts: LatLon[]): number[] {
  const xy = aPlano(pts);
  const imp = new Array<number>(pts.length).fill(0);
  imp[0] = SIEMPRE;
  imp[pts.length - 1] = SIEMPRE;
  // sin recursión: una ruta larga trae miles de puntos. Un punto no importa
  // más que el que partió su tramo, así quitarlo nunca deja huecos.
  const pendientes: [number, number, number][] = [[0, pts.length - 1, SIEMPRE]];
  while (pendientes.length > 0) {
    const [desde, hasta, padre] = pendientes.pop()!;
    const { indice, maxima } = masLejano(xy, desde, hasta);
    if (indice === -1) continue;
    const propia = Math.min(maxima, padre);
    imp[indice] = propia;
    pendientes.push([desde, indice, propia], [indice, hasta, propia]);
  }
  return imp;
}

/**
 * Douglas–Peucker con tolerancia en metros: ningún punto quitado queda a más
 * de `toleranciaM` de la línea que resulta. Conserva siempre los extremos.
 */
export function simplificarRuta(pts: LatLon[], toleranciaM: number): LatLon[] {
  if (pts.length <= 2) return pts;
  const imp = importancias(pts);
  return pts.filter((_, i) => imp[i]! > toleranciaM);
}

/**
 * La ruta en a lo más `max` puntos, lo más fiel posible: se quedan los `max`
 * puntos que más importan para la forma, en su orden.
 */
export function ajustarRutaAMaximo(pts: LatLon[], max: number): LatLon[] {
  if (pts.length <= max) return pts;
  const imp = importancias(pts);
  const elegidos = pts
    .map((_, i) => i)
    .sort((a, b) => imp[b]! - imp[a]!)
    .slice(0, max)
    .sort((a, b) => a - b);
  return elegidos.map((i) => pts[i]!);
}
