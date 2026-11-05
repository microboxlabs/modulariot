// Geocercas guardadas como opciones para el origen y el destino de un
// trayecto: se eligen igual que una dirección, en el centro de la geocerca.
import type { Sugerencia } from "../data/geocoding";
import { parentPlaceId } from "../geofences/inner-geofences";
import { anclaLugar } from "../map/place-labels";
import type { Lugar } from "../places.types";

/** Cuántas geocercas se ofrecen a la vez, sobre las direcciones. */
export const MAX_OPCIONES_GEOCERCA = 5;

function coincide(l: Lugar, q: string): boolean {
  return [l.name, l.address, l.external_id].some((c) =>
    (c ?? "").toLowerCase().includes(q)
  );
}

/**
 * Las geocercas que calzan con lo escrito (todas si no hay texto), sin las
 * interiores: el origen o destino es la geocerca completa.
 */
export function opcionesGeocerca(
  lugares: Lugar[],
  texto: string,
  max = MAX_OPCIONES_GEOCERCA
): Sugerencia[] {
  const q = texto.trim().toLowerCase();
  return lugares
    .filter((l) => !parentPlaceId(l) && (!q || coincide(l, q)))
    .flatMap((l) => {
      const punto = anclaLugar(l);
      if (!punto) return [];
      return [
        {
          id: `geocerca:${l.place_id}`,
          nombre: l.name,
          contexto: l.address ?? "",
          punto,
          geocerca: true,
        },
      ];
    })
    .slice(0, max);
}
