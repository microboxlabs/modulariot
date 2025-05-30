export const ROUTE_PERMISSIONS = {
  // Main routes
  "/": [], // Public route
  "/shipping": ["SHIPPING_ADMIN", "SHIPPING_USER"],
  "/finished": ["SHIPPING_ADMIN", "SHIPPING_USER"],
  "/reports": ["REPORTS_ADMIN", "REPORTS_USER"],
  "/geographic-view": ["GEOGRAPHIC_VIEW_ADMIN", "GEOGRAPHIC_VIEW_USER"],
  "/symptoms": ["SYMPTOMS_ADMIN", "SYMPTOMS_USER"],

  // Task routes
  "/task/edit": ["SHIPPING_ADMIN", "SHIPPING_USER"],
  "/task/view": ["SHIPPING_ADMIN", "SHIPPING_USER"],

  // Settings routes
  "/users/settings": ["ADMIN", "SETTINGS_ADMIN"],

  // API routes
  "/api/task": ["SHIPPING_ADMIN", "SHIPPING_USER"],
  "/api/reports": ["REPORTS_ADMIN", "REPORTS_USER"],
  "/api/geographic": ["GEOGRAPHIC_VIEW_ADMIN", "GEOGRAPHIC_VIEW_USER"],
  "/api/symptoms": ["SYMPTOMS_ADMIN", "SYMPTOMS_USER"],
} as const;

export type RouteKey = keyof typeof ROUTE_PERMISSIONS;

export function getRoutePermissions(path: string): string[] {
  // Find the most specific matching route
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => path.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  return matchingRoute ? [...ROUTE_PERMISSIONS[matchingRoute as RouteKey]] : [];
}
