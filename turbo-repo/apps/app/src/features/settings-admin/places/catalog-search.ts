import { parentPlaceId } from "./inner-geofences";
import type { Lugar, Trayecto } from "./places.types";

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
