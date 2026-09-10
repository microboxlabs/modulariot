/**
 * Matriz de capacidades del PORTAL DE TRANSPORTISTA (PT2).
 *
 * Contrato: diseno_pt1_portal.md §B — el carrier entra al MISMO app y la
 * experiencia se define habilitando/deshabilitando la navegación existente
 * (decisión Erick 2026-07-21: sin front nuevo). Esta matriz es la ÚNICA
 * fuente de qué ve una org con el módulo CARRIER_PORTAL.
 *
 * La ocultación de navegación es cortesía de UX; la seguridad real vive en
 * las API routes (tenant por `resolveTenantScope`, jamás desde el cliente).
 * Módulo puro de datos: lo consumen el cliente (sidebar) y el servidor.
 */

export const CARRIER_PORTAL_MODULE = "CARRIER_PORTAL";

/** Rutas exactas NEGADAS aunque un prefijo permitido las cubra. */
const DENY_EXACT = new Set<string>([
  "/gxc/carrier", // ranking entre pares: fuga comercial (su perfil entra por N3)
  "/planning", // asignar recursos es de torre
]);

/** Prefijos habilitados para una org carrier (matriz §B, decisiones 2026-07-21). */
const ALLOW_PREFIXES = [
  "/home",
  "/shipping",
  "/delivery",
  "/finished",
  "/mytasks",
  "/geographic-view",
  "/symptoms",
  "/signal-history",
  "/whatsapp",
  "/gemelo", // decisión Erick: gemelo SÍ en v1, filtrado al tenant (server-side)
  "/gxc",
  "/collaborators-management",
  "/fleet-management",
  "/capacity", // Capacity Desk (capacity-core C2): su capacidad, su agenda
  "/users/settings", // su organización; los items de plataforma se niegan abajo
];

const DENY_PREFIXES = [
  "/calendar", // fuera por ahora (decisión 2026-07-21)
  "/where-is-my-load", // fuera por ahora (share)
  "/live-streams",
  "/integrations",
  "/users/settings/data-sources", // plataforma
  "/users/settings/service-archetypes", // molde de la UO: define la torre (v1)
  "/admin",
];

/** ¿Puede una org carrier ver este href de la navegación/rutas? */
export function carrierNavAllowed(href: string): boolean {
  const path = (href.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return true;
  if (DENY_EXACT.has(path)) return false;
  if (DENY_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  return ALLOW_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
