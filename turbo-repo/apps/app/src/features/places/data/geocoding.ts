// Búsqueda de direcciones (Mapbox Geocoding v6) para trazar trayectos
// escribiendo origen y destino.
import type { LatLon } from "../places.types";
import { decodificar, extraerPlusCode, recuperarCorto } from "./plus-code";

/** Las operaciones son en Chile: limitar resultados al país. */
const PAIS = "cl";

export type Sugerencia = {
  id: string;
  /** Línea principal: calle y número o nombre del lugar. */
  nombre: string;
  /** Contexto: comuna, región. */
  contexto: string;
  punto: LatLon;
  /** Una geocerca guardada, no una dirección (se muestra con su icono). */
  geocerca?: boolean;
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
 * Un Plus Code de Google escrito en la búsqueda, como única sugerencia. El
 * completo va directo a su punto; el corto se ubica cerca de la localidad
 * escrita junto a él (geocodificada) o, sin localidad, del centro del mapa.
 * null si el texto no es un Plus Code; [] si es corto y no hay referencia.
 */
async function sugerenciaPlusCode(
  q: string,
  token: string,
  cerca: LatLon | null | undefined,
  signal?: AbortSignal
): Promise<Sugerencia[] | null> {
  const pc = extraerPlusCode(q);
  if (!pc) return null;
  // sin punto (la librería no pudo decodificarlo): ninguna sugerencia
  const sugerencia = (punto: LatLon | null, contexto: string): Sugerencia[] =>
    punto
      ? [{ id: `pluscode:${pc.codigo}`, nombre: pc.codigo, contexto, punto }]
      : [];
  if (pc.completo) return sugerencia(decodificar(pc.codigo), "Plus Code");
  if (pc.resto) {
    const [localidad] = await buscarEnMapbox(pc.resto, token, cerca, signal);
    if (!localidad) return [];
    const donde = [localidad.nombre, localidad.contexto]
      .filter(Boolean)
      .join(", ");
    return sugerencia(
      recuperarCorto(pc.codigo, localidad.punto),
      `Plus Code · ${donde}`
    );
  }
  if (!cerca) return [];
  return sugerencia(
    recuperarCorto(pc.codigo, cerca),
    "Plus Code · cerca del centro del mapa"
  );
}

/**
 * Sugerencias para el texto `q` (dirección o Plus Code). `cerca` ([lat, lon], centro del mapa) ordena
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
  const plus = await sugerenciaPlusCode(texto, token, cerca, signal);
  return plus ?? buscarEnMapbox(texto, token, cerca, signal);
}

async function buscarEnMapbox(
  texto: string,
  token: string,
  cerca: LatLon | null | undefined,
  signal?: AbortSignal
): Promise<Sugerencia[]> {
  const params = new URLSearchParams({
    q: texto,
    country: PAIS,
    // Selected coordinates/addresses are saved as Places, so request storable results.
    permanent: "true",
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

/** Dirección más cercana a un clic en el mapa, o null si no hay resultado. */
export async function direccionDesdePunto(
  punto: LatLon,
  token: string,
  signal?: AbortSignal
): Promise<string | null> {
  const params = new URLSearchParams({
    longitude: String(punto[1]),
    latitude: String(punto[0]),
    country: PAIS,
    // Selected coordinates/addresses are saved as Places, so request storable results.
    permanent: "true",
    language: "es",
    limit: "1",
    access_token: token,
  });
  try {
    const r = await fetch(
      `https://api.mapbox.com/search/geocode/v6/reverse?${params}`,
      { signal }
    );
    if (!r.ok) return null;
    const json = (await r.json()) as {
      features?: {
        properties?: { name?: string; full_address?: string };
      }[];
    };
    const props = json.features?.[0]?.properties;
    return props?.full_address ?? props?.name ?? null;
  } catch {
    return null;
  }
}
