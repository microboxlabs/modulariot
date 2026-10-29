import { parentPlaceId } from "../geofences/inner-geofences";
import type { Lugar, Trayecto } from "../places.types";

function coincide(
  q: string,
  ...campos: (string | null | undefined)[]
): boolean {
  return campos.some((c) => (c ?? "").toLowerCase().includes(q));
}

export function filtrarLugares(lugares: Lugar[], busca: string): Lugar[] {
  const q = busca.trim().toLowerCase();
  if (!q) return lugares;
  const hit = new Set(
    lugares
      .filter((l) => coincide(q, l.name, l.address, l.external_id, l.category))
      .map((l) => l.place_id)
  );
  for (const l of lugares) {
    const padre = parentPlaceId(l);
    if (padre && hit.has(l.place_id)) hit.add(padre);
    if (padre && hit.has(padre)) hit.add(l.place_id);
  }
  return lugares.filter((l) => hit.has(l.place_id));
}

/** Valor del filtro para los lugares sin categoría. */
export const SIN_CATEGORIA = "__sin_categoria__";

const categoriaDe = (l: Lugar) => l.category ?? SIN_CATEGORIA;

// por nombre, y los sin categoría al final
function compararCategorias(a: string, b: string): number {
  if (a === SIN_CATEGORIA) return 1;
  if (b === SIN_CATEGORIA) return -1;
  return a.localeCompare(b, "es");
}

/** Las categorías de los lugares, con cuántos tiene cada una. */
export function categoriasDeLugares(
  lugares: Lugar[]
): { categoria: string; total: number }[] {
  const totales = new Map<string, number>();
  for (const l of lugares) {
    const c = categoriaDe(l);
    totales.set(c, (totales.get(c) ?? 0) + 1);
  }
  return [...totales]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => compararCategorias(a.categoria, b.categoria));
}

/** Los lugares de una categoría; "" son todos. */
export function filtrarPorCategoria(
  lugares: Lugar[],
  categoria: string
): Lugar[] {
  if (!categoria) return lugares;
  return lugares.filter((l) => categoriaDe(l) === categoria);
}

export function filtrarTrayectos(
  trayectos: Trayecto[],
  busca: string
): Trayecto[] {
  const q = busca.trim().toLowerCase();
  if (!q) return trayectos;
  return trayectos.filter((t) =>
    coincide(q, t.name, t.external_id, t.parent_name, t.kind)
  );
}
