// Búsqueda de direcciones (Mapbox Geocoding v6) para trazar trayectos
// escribiendo origen y destino.
import type { LatLon } from "./places.types";

/** Las operaciones son en Chile: limitar resultados al país. */
const PAIS = "cl";

export type Sugerencia = {
  id: string;
  /** Línea principal: calle y número o nombre del lugar. */
  nombre: string;
  /** Contexto: comuna, región. */
  contexto: string;
  punto: LatLon;
};

type FeatureV6 = {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
  };
};

export function parsearSugerencias(json: unknown): Sugerencia[] {
  const features = (json as { features?: FeatureV6[] } | null)?.features ?? [];
  return features.flatMap((f, i) => {
    const c = f.geometry?.coordinates;
    const nombre = f.properties?.name ?? f.properties?.full_address;
    if (!c || !nombre) return [];
    return [
      {
        id: f.properties?.mapbox_id ?? f.id ?? String(i),
        nombre,
        contexto: f.properties?.place_formatted ?? "",
        punto: [c[1], c[0]] as LatLon,
      },
    ];
  });
}

/**
 * Sugerencias para el texto `q`. `cerca` ([lat, lon], centro del mapa) ordena
 * primero lo cercano. Devuelve [] ante cualquier error.
 */
export async function buscarDirecciones(
  q: string,
  token: string,
  cerca?: LatLon | null,
  signal?: AbortSignal
): Promise<Sugerencia[]> {
  const texto = q.trim();
  if (texto.length < 3) return [];
  const params = new URLSearchParams({
    q: texto,
    country: PAIS,
    language: "es",
    limit: "5",
    autocomplete: "true",
    access_token: token,
  });
  if (cerca) params.set("proximity", `${cerca[1]},${cerca[0]}`);
  try {
    const r = await fetch(
      `https://api.mapbox.com/search/geocode/v6/forward?${params}`,
      { signal }
    );
    return r.ok ? parsearSugerencias(await r.json()) : [];
  } catch {
    return [];
  }
}
