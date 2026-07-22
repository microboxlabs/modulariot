import "server-only";

/**
 * Provider del Gemelo Digital (laboratorio GOL local).
 *
 * Fuente actual: PostgREST local (GOL_API_URL) alimentado por el sync delta.
 * El contrato son funciones `fn_dx_gol_*` de SOLO LECTURA; cuando el equipo
 * exponga estos precálculos vía nexo/ECM, basta reemplazar este provider —
 * las API routes y el front no cambian.
 */

const GOL_API_URL = process.env.GOL_API_URL ?? "http://127.0.0.1:3010";

/** Funciones RPC permitidas (solo lectura). Nada fuera de esta lista sale al backend. */
export const GOL_RPC_ALLOWLIST = new Set([
  "fn_dx_gol_replay_flota",
  "fn_dx_gol_replay_ventana",
  "fn_dx_gol_replay_candidatos",
  "fn_dx_gol_replay_servicio",
  "fn_dx_gol_grid_replay",
  "fn_dx_gol_replay_filtros",
  "fn_dx_gol_mapa_geocercas",
  "fn_dx_gol_zonas",
  "fn_dx_gol_nodos",
  "fn_dx_gol_trayectos",
  "fn_dx_gol_rutas_historicas",
  "fn_dx_gol_proceso_flujo",
  "fn_dx_gol_proceso_filtros",
  "fn_dx_gol_proceso_servicios",
  "fn_dx_gol_proceso_complementos",
  "fn_dx_gol_proceso_whatif_base",
  "fn_dx_gol_proceso_avanzado",
  "fn_dx_gol_carga_overview",
  "fn_dx_gol_carga_filtros",
  "fn_dx_gol_carga_palancas",
  "fn_dx_gol_carga_whatif_base",
  "fn_dx_gol_perfiles_poblacion",
  "fn_dx_gol_perfiles_evolutivo",
  "fn_dx_gol_perfiles_foco",
  "fn_dx_gol_perfil_cruce",
  "fn_dx_gol_perfil",
  "fn_dx_gol_superprofile_visor",
  "fn_dx_gol_gxc_poblacion",
  "fn_dx_gol_gxc_perfil",
  "fn_dx_gol_gxc_baseline",
  "fn_dx_gol_gxc_poblacion_evolucion",
  "fn_dx_gol_simular",
]);

/**
 * Fns que ACEPTAN el filtro de tenant p_carrier_rut (PT3). Para una org
 * carrier el proxy INYECTA el RUT del scope en estas fns; las demás fns
 * responden 403 al carrier (fail-closed: módulo sin filtro imponible no se
 * enciende — diseno_pt1_portal §F.3). Se amplía fn por fn con su migración.
 */
export const GOL_RPC_CARRIER_FILTERABLE = new Set([
  "fn_dx_gol_gxc_poblacion",
  "fn_dx_gol_gxc_perfil",
  "fn_dx_gol_gxc_poblacion_evolucion",
]);

/**
 * Fns ABIERTAS para orgs carrier sin inyección de tenant: devuelven SOLO
 * agregados anónimos del período (sin nombres ni ranking de pares) — la
 * línea base contra la que el carrier se compara (diseño §A.5).
 */
export const GOL_RPC_CARRIER_OPEN = new Set(["fn_dx_gol_gxc_baseline"]);

/** RPCs por POST: cálculo de red y gestión de zonas del usuario (BD del gemelo, no prod). */
export const GOL_RPC_POST_ALLOWLIST = new Set([
  "fn_dx_gol_circuito_red",
  "fn_dx_gol_zona_guardar",
  "fn_dx_gol_zona_borrar",
  "fn_dx_gol_simular",
]);

export class GolApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/** GET a una función RPC del gemelo. Params van como query string (PostgREST). */
export async function golRpc(
  fn: string,
  params: URLSearchParams
): Promise<unknown> {
  if (!GOL_RPC_ALLOWLIST.has(fn)) {
    throw new GolApiError(404, `RPC no permitida: ${fn}`);
  }
  const qs = params.toString();
  const res = await fetch(`${GOL_API_URL}/rpc/${fn}${qs ? `?${qs}` : ""}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GolApiError(res.status, `GOL RPC ${fn}: ${res.statusText}`);
  }
  return res.json();
}

/** POST a una función RPC del gemelo (body JSON de PostgREST). */
export async function golRpcPost(fn: string, body: unknown): Promise<unknown> {
  if (!GOL_RPC_POST_ALLOWLIST.has(fn)) {
    throw new GolApiError(404, `RPC POST no permitida: ${fn}`);
  }
  const res = await fetch(`${GOL_API_URL}/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new GolApiError(res.status, `GOL RPC ${fn}: ${res.statusText}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
