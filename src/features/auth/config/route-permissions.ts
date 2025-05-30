const FULL_ACCESS_ROLES = [
  "MINTRAL_EJECUTIVO_TORRE_CONTROL",
  "MINTRAL_OPERADORES",
  "MINTRAL_OVERLORD_VIAJES",
  "MINTRAL_RECEPTOR_VIAJES",
  "MINTRAL_REGULARIZADORES_VIAJES",
  "MINTRAL_VALIDADOR_TRANSPORTE",
];
export const ROUTE_PERMISSIONS = {
  // Main routes
  "/": [], // Public route
  "/shipping": FULL_ACCESS_ROLES,
  "/finished": FULL_ACCESS_ROLES,
  "/reports": FULL_ACCESS_ROLES,
  "/geographic-view": FULL_ACCESS_ROLES,
  "/symptoms": FULL_ACCESS_ROLES,

  // Task routes
  "/task/edit": FULL_ACCESS_ROLES,
  "/task/view": FULL_ACCESS_ROLES,

  // Settings routes
  "/users/settings": FULL_ACCESS_ROLES,

  // API routes
  "/api/task": FULL_ACCESS_ROLES,
  "/api/geographic": FULL_ACCESS_ROLES,
  "/api/symptoms": FULL_ACCESS_ROLES,
} as const;

export type RouteKey = keyof typeof ROUTE_PERMISSIONS;

export function getRoutePermissions(path: string): string[] {
  // Find the most specific matching route
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => path.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  return matchingRoute ? [...ROUTE_PERMISSIONS[matchingRoute as RouteKey]] : [];
}
