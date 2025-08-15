const FULL_ACCESS_ROLES = [
  "GROUP_MINTRAL_EJECUTIVO_TORRE_CONTROL",
  "GROUP_MINTRAL_OPERADORES",
  "GROUP_MINTRAL_OVERLORD_VIAJES",
  "GROUP_MINTRAL_RECEPTOR_VIAJES",
  "GROUP_MINTRAL_REGULARIZADORES_VIAJES",
  "GROUP_MINTRAL_VALIDADOR_TRANSPORTE",
];

// Admin roles for system management
const ADMIN_ROLES = [
  "GROUP_ALFRESCO_ADMINISTRATORS",
  "GROUP_MINTRAL_SYSTEM_ADMIN",
];

// Define groups that should be blocked from certain routes
const BLOCKED_GROUPS = {
  GROUP_MINTRAL_REVISOR: ["/symptoms", "/geographic-view"], // Revisors cannot access symptoms and geographic view
};

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
  "/api/admin/logs": ADMIN_ROLES,
} as const;

export type RouteKey = keyof typeof ROUTE_PERMISSIONS;

export function getRoutePermissions(path: string): string[] {
  // Find the most specific matching route
  const matchingRoute = Object.keys(ROUTE_PERMISSIONS)
    .filter((route) => path.startsWith(route))
    .sort((a, b) => b.length - a.length)[0];

  return matchingRoute ? [...ROUTE_PERMISSIONS[matchingRoute as RouteKey]] : [];
}

export function getBlockedGroupsForRoute(path: string): string[] {
  const blockedGroups: string[] = [];

  // Check if any group should be blocked from this specific path
  Object.entries(BLOCKED_GROUPS).forEach(([group, blockedRoutes]) => {
    if (blockedRoutes.some((route) => path.startsWith(route))) {
      blockedGroups.push(group);
    }
  });

  return blockedGroups;
}

export function hasRouteAccess(
  userGroups: string[],
  path: string,
  operator: "OR" | "AND" = "OR"
): boolean {
  const requiredGroups = getRoutePermissions(path);
  const blockedGroups = getBlockedGroupsForRoute(path);

  // Check if user has any blocked groups
  const hasBlockedGroup = blockedGroups.some((group) =>
    userGroups.includes(group)
  );

  if (hasBlockedGroup) {
    return false; // User is blocked from this route
  }

  // If no required groups, access is allowed (unless blocked above)
  if (!requiredGroups.length) {
    return true;
  }

  // Check if user has required groups
  return operator === "OR"
    ? requiredGroups.some((group) => userGroups.includes(group))
    : requiredGroups.every((group) => userGroups.includes(group));
}
