import type { LatLon } from "./places.types";

/** PlaceForm pasa `[lat, lon]`; el mapa necesita lat y lon sueltos. */
export function ubicarPuntoEnMapa(
  punto: LatLon,
  radioM: number,
  encuadrar: (lat: number, lon: number, radioM: number) => void
) {
  encuadrar(punto[0], punto[1], radioM);
}
