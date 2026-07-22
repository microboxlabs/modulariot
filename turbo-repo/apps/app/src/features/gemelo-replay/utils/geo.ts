// Utilidades geométricas del Gemelo Digital — reemplazo local y sin
// dependencias de las funciones de @turf usadas por el laboratorio
// (point, booleanPointInPolygon, area, bbox, centroid, kinks).

import type { Feature, Polygon, Position } from "geojson";

export type LngLat = [number, number];

const R = 6378137; // radio WGS84 (m) — mismo que usa turf.area

function rings(geom: Polygon): Position[][] {
  return geom.coordinates;
}

/** Ray casting con anillos interiores (agujeros). */
export function pointInPolygon(pt: LngLat, poly: Feature<Polygon> | Polygon): boolean {
  const geom = "geometry" in poly ? poly.geometry : poly;
  const [x, y] = pt;
  let inside = false;
  for (const ring of rings(geom)) {
    let hit = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        hit = !hit;
      }
    }
    if (ring === geom.coordinates[0]) inside = hit;
    else if (hit) return false; // dentro de un agujero
  }
  return inside;
}

/** Área geodésica en m² (Chamberlain & Duquette, como turf.area). */
export function polygonAreaM2(poly: Feature<Polygon> | Polygon): number {
  const geom = "geometry" in poly ? poly.geometry : poly;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  geom.coordinates.forEach((ring, idx) => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [l1, f1] = ring[j];
      const [l2, f2] = ring[i];
      sum += (rad(l2) - rad(l1)) * (2 + Math.sin(rad(f1)) + Math.sin(rad(f2)));
    }
    const a = Math.abs((sum * R * R) / 2);
    total += idx === 0 ? a : -a;
  });
  return total;
}

/** [minX, minY, maxX, maxY] de cualquier geometría de anillos/líneas. */
export function bboxOf(geomOrFeature: unknown): [number, number, number, number] {
  const gf = geomOrFeature as { geometry?: { coordinates?: unknown }; coordinates?: unknown };
  const coords = gf.geometry?.coordinates ?? gf.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const [x, y] = c as number[];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(coords);
  return [minX, minY, maxX, maxY];
}

/** Centroide = promedio de vértices (comportamiento de turf.centroid). */
export function centroidOf(geomOrFeature: unknown): LngLat {
  const gf = geomOrFeature as { geometry?: { coordinates?: unknown }; coordinates?: unknown };
  const coords = gf.geometry?.coordinates ?? gf.coordinates;
  let sx = 0, sy = 0, n = 0;
  const seen = new Set<string>();
  const walk = (c: unknown) => {
    if (Array.isArray(c) && typeof c[0] === "number") {
      const key = `${c[0]},${c[1]}`;
      if (!seen.has(key)) { seen.add(key); sx += c[0] as number; sy += c[1] as number; n++; }
    } else if (Array.isArray(c)) c.forEach(walk);
  };
  walk(coords);
  return n ? [sx / n, sy / n] : [0, 0];
}

/** ¿El polígono se auto-intersecta? (equivalente práctico de turf.kinks) */
export function hasKinks(poly: Feature<Polygon> | Polygon): boolean {
  const geom = "geometry" in poly ? poly.geometry : poly;
  const segsCross = (a: Position, b: Position, c: Position, d: Position) => {
    const ccw = (p: Position, q: Position, r: Position) =>
      (r[1] - p[1]) * (q[0] - p[0]) > (q[1] - p[1]) * (r[0] - p[0]);
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  };
  for (const ring of rings(geom)) {
    for (let i = 0; i < ring.length - 1; i++) {
      for (let j = i + 2; j < ring.length - 1; j++) {
        if (i === 0 && j === ring.length - 2) continue; // segmentos adyacentes por cierre
        if (segsCross(ring[i], ring[i + 1], ring[j], ring[j + 1])) return true;
      }
    }
  }
  return false;
}
