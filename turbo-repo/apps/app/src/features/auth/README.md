# Route Permissions System

This system supports both **allowlist** and **blocklist** approaches for route permissions.

## Features

### 1. Allowlist (Original Logic)

- Users must have specific groups to access routes
- If no groups are required, access is allowed

### 2. Blocklist (Opposite Logic)

- Users with specific groups are blocked from accessing certain routes
- Takes precedence over allowlist logic

### 3. Sidebar Navigation Protection

- Sidebar items can be hidden from users with blocked groups
- Prevents users from seeing navigation options they can't access

## Configuration

### Route Permissions (Allowlist)

```typescript
export const ROUTE_PERMISSIONS = {
  "/shipping": ["CONTROL_TOWER_LEAD", "OPERATORS"],
  "/reports": ["CONTROL_TOWER_LEAD"],
  "/": [], // Public route
} as const;
```

### Blocked Groups (Blocklist)

```typescript
const BLOCKED_GROUPS = {
  REVIEWER: ["/reports", "/geographic-view"], // Reviewers cannot access reports and geographic view
  REVIEWER: ["/users/settings", "/api/symptoms"], // Basic operators cannot access settings and symptoms API
};
```

### Sidebar Configuration (Hide Navigation Items)

```typescript
export const pages: SidebarItem[] = [
  {
    href: "/reports",
    icon: ChartMixedIcon,
    label: "controlTower",
    items: [
      {
        href: "/geographic-view",
        label: "geographicView",
        blockedGroups: ["REVIEWER"], // Hide from reviewers
      },
      {
        href: "/symptoms",
        label: "symptoms",
        blockedGroups: ["REVIEWER"], // Hide from reviewers
      },
    ],
    blockedGroups: ["REVIEWER"], // Hide entire reports section from reviewers
  },
];
```

## Usage Examples

### 1. Using RouteGuard Component (Recommended)

**For route-level protection (uses hasRoutePermission):**

```tsx
// This will check both allowlist and blocklist for the specific route
<RouteGuard path="/reports" fallbackPath="/shipping">
  <ReportsPage />
</RouteGuard>

<RouteGuard path="/geographic-view" fallbackPath="/shipping">
  <GeographicViewPage />
</RouteGuard>
```

**For component-level protection (manual checks):**

```tsx
// Allowlist only
<RouteGuard requiredGroups={["CONTROL_TOWER_LEAD"]}>
  <ReportsPage />
</RouteGuard>

// Blocklist only
<RouteGuard blockedGroups={["REVIEWER"]}>
  <ReportsPage />
</RouteGuard>

// Both allowlist and blocklist
<RouteGuard
  requiredGroups={["CONTROL_TOWER_LEAD"]}
  blockedGroups={["REVIEWER"]}
>
  <ReportsPage />
</RouteGuard>
```

### 2. Using usePermissions Hook

```tsx
const { hasPermission, hasRoutePermission, userGroups } = usePermissions();

// Check specific groups
const canAccessReports = hasPermission(["CONTROL_TOWER_LEAD"]);

// Check route access (includes both allowlist and blocklist logic)
const canAccessRoute = hasRoutePermission("/reports");
```

### 3. Programmatic Access Check

```tsx
import { hasRouteAccess } from "@/features/auth/config/route-permissions";

const userGroups = ["REVIEWER", "OPERATORS"];
const canAccess = hasRouteAccess(userGroups, "/reports"); // false (blocked by REVIEWER)
```

## Logic Flow

1. **Blocklist Check First**: If user has any blocked groups for the route, access is denied
2. **Allowlist Check**: If no required groups, access is allowed (unless blocked above)
3. **Group Check**: User must have required groups (OR/AND logic)

## Implementation in Pages

To protect a page from blocked groups, wrap it with RouteGuard:

```tsx
// src/app/[lang]/(secured)/reports/page.tsx
import { RouteGuard } from "@/features/auth/components/route-guard";

export default async function ReportsPage({ params: { lang } }) {
  return (
    <RouteGuard path="/reports" fallbackPath={`/${lang}/shipping`}>
      <div>
        {/* Your page content */}
        Reports content here...
      </div>
    </RouteGuard>
  );
}
```

## Sidebar Navigation Protection

The sidebar automatically hides items from users with blocked groups:

```typescript
// In src/features/layout/models/pages.ts
{
  href: "/reports",
  label: "controlTower",
  blockedGroups: ["REVIEWER"], // Entire section hidden from reviewers
  items: [
    {
      href: "/geographic-view",
      label: "geographicView",
      blockedGroups: ["REVIEWER"], // Individual item hidden
    },
  ],
}
```

## Adding New Restrictions

To add new route restrictions:

1. **For allowlist**: Add groups to `ROUTE_PERMISSIONS`
2. **For blocklist**: Add group-route pairs to `BLOCKED_GROUPS`
3. **For sidebar**: Add `blockedGroups` to sidebar items in `pages.ts`

Example:

```typescript
const BLOCKED_GROUPS = {
  REVIEWER: ["/reports", "/geographic-view"],
  BASIC_OPERATOR: ["/users/settings", "/api/symptoms"],
  NEW_GROUP: ["/restricted-route"], // Add new restriction
};
```

## Why RouteGuard with path prop is recommended

The `path` prop in RouteGuard uses the `hasRoutePermission` function which:

- Automatically checks the route permissions configuration
- Applies both allowlist and blocklist logic
- Ensures consistent permission checking across the application
- Reduces manual configuration in each component

## Complete Protection Flow

1. **Sidebar**: Items hidden from users with blocked groups
2. **Route Access**: RouteGuard prevents access to protected pages
3. **API Protection**: Server-side checks prevent unauthorized API calls
