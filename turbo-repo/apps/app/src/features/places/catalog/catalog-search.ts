import { parentPlaceId } from "../geofences/inner-geofences";
import type { Lugar, Trayecto } from "../places.types";

function coincide(
  q: string,
  ...campos: (string | null | undefined)[]
): boolean {
  return campos.some((c) => (c ?? "").toLowerCase().includes(q));
}

// los que cumplen, con sus geocercas internas o su geocerca madre
function conFamilia(lugares: Lugar[], cumple: (l: Lugar) => boolean) {
  const hit = new Set(lugares.filter(cumple).map((l) => l.place_id));
  for (const l of lugares) {
    const padre = parentPlaceId(l);
    if (padre && hit.has(l.place_id)) hit.add(padre);
  }
  return lugares.filter((l) => {
    const parent = parentPlaceId(l);
    return hit.has(l.place_id) || (parent !== null && hit.has(parent));
  });
}

export function filtrarLugares(lugares: Lugar[], busca: string): Lugar[] {
  const q = busca.trim().toLowerCase();
  if (!q) return lugares;
  return conFamilia(lugares, (l) =>
    coincide(q, l.name, l.address, l.external_id, l.category)
  );
}

/** Por qué se busca en la barra: el nombre o la categoría de la geocerca. */
export type CampoBusqueda = "name" | "category";

/** Un filtro de la barra, elegido de sus sugerencias: «Categoría: planta». */
export type EtiquetaBusqueda = { matchType: CampoBusqueda; value: string };

/** El texto de cada campo, como lo compara la barra. */
const VALOR_CAMPO: Record<CampoBusqueda, (l: Lugar) => string | null> = {
  name: (l) => l.name,
  category: (l) => l.category,
};

/**
 * Los lugares que cumplen los filtros: en un mismo campo basta uno («planta»
 * o «puerto»); entre campos, todos. Contiene, como cuenta la barra.
 */
export function filtrarPorEtiquetas(
  lugares: Lugar[],
  etiquetas: EtiquetaBusqueda[]
): Lugar[] {
  if (etiquetas.length === 0) return lugares;
  const campos = Object.keys(VALOR_CAMPO) as CampoBusqueda[];
  const cumple = (l: Lugar) =>
    campos.every((campo) => {
      const qs = etiquetas
        .filter((e) => e.matchType === campo)
        .map((e) => e.value.trim().toLowerCase());
      return (
        qs.length === 0 || qs.some((q) => coincide(q, VALOR_CAMPO[campo](l)))
      );
    });
  return conFamilia(lugares, cumple);
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
