# Access control

Pages, menus, buttons and API routes are gated by access rules. A rule lists the Alfresco groups that open it and the IAM permission that replaces them.

## Access source

`ACCESS_CONTROL_SOURCE` sets what decides each rule. The client reads it from the runtime config.

| Value | Decides with | Notes |
| --- | --- | --- |
| `groups` (default) | Alfresco groups | |
| `shadow` | Alfresco groups | Also computes the permission decision and logs every mismatch as `Access mismatch between groups and permissions`. |
| `permissions` | Permissions in the active organization (`GET /api/v1/orgs/{org}/me/access`) | Gates stay closed while permissions load. Server page guards are active. |

A rule without `requiredPermissions` is decided by groups in every mode.

## Files

| File | Contents |
| --- | --- |
| `access/access-control.ts` | `AccessRule`, `decideAccess`, `parseAccessSource` |
| `access/access-rules.ts` | `ACCESS_RULES`: every gate with its groups and permission |
| `access/server-access.ts` | `requirePermission` (API routes), `guardPage` (server pages), `hasAccess` |
| `config/route-permissions.ts` | Page path prefix → rule, used by `RouteGuard` |
| `hooks/use-permissions.ts` | `usePermissions().canAccess(rule)` for client components |
| `components/route-guard.tsx` | Client page guard |
| `components/access-allowed.tsx` | Renders children when a rule is open |

Menu entries in `features/layout/models/pages-config.json` carry `requiredGroups`, `blockedGroups` and `requiredPermissions`. The sidebar, Spotlight and the Pagefind index use the same decision.

## Usage

**API route**

```ts
const access = await requirePermission(ACCESS_RULES.adminConsole, "/api/admin/logs");
if (!access.authorized) return access.response;
```

Returns 401 without a session and 403 when the rule is closed.

**Server page**

```ts
await guardPage(ACCESS_RULES.finished, "/finished");
```

Renders the not-found page when the rule is closed. It only runs in `permissions` mode, unless `{ always: true }` is passed.

**Client component**

```tsx
<RouteGuard path="/shipping" fallbackPath={`/${lang}/geographic-view`}>…</RouteGuard>
<AccessAllowed rule={ACCESS_RULES.taskComplete}>…</AccessAllowed>
```

## Adding a gate

1. Add the permission to `PERMISSIONS` and the rule to `ACCESS_RULES`.
2. Add the path to `ROUTE_PERMISSIONS` and call `guardPage` in the page.
3. Add `requiredPermissions` to the menu entry in `pages-config.json`.
