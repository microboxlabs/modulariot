# Access control

Pages, menus, buttons and API routes are gated by access rules. A rule lists IAM permissions. Any one of them opens it. A rule without permissions is open.

Permissions come from the caller's roles in the active organization (`GET /api/v1/orgs/{org}/me/access`). Gated rules stay closed while permissions load and when they cannot be loaded.

## Files

| File | Contents |
| --- | --- |
| `access/access-control.ts` | `AccessRule`, `decideAccess` |
| `access/access-rules.ts` | `PERMISSIONS` and `ACCESS_RULES` |
| `access/server-access.ts` | `requirePermission` (API routes), `guardPage` (server pages), `hasAccess`, `requirePlatformOwner` and `guardPlatformOwnerPage` (deployment-wide surfaces) |
| `config/route-permissions.ts` | Page path prefix → rule, used by `RouteGuard` |
| `hooks/use-permissions.ts` | `usePermissions().canAccess(rule)` for client components |
| `components/route-guard.tsx` | Client page guard |
| `components/access-allowed.tsx` | Renders children when a rule is open |

Menu entries in `features/layout/models/pages-config.json` carry `requiredPermissions`. The sidebar, Spotlight and the Pagefind index use the same decision.

## Usage

**API route**

```ts
const access = await requirePermission(ACCESS_RULES.taskUnclaim, "/api/task/unclaim");
if (!access.authorized) return access.response;
```

Returns 401 without a session and 403 when the rule is closed.

The log console (`/api/admin/logs`, `/admin/console/logs`) changes the process-wide logger, so it uses `requirePlatformOwner` and `guardPlatformOwnerPage`: only a platform owner passes (`GET /api/v1/platform/roles/me`).

**Server page**

```ts
await guardPage(ACCESS_RULES.finished, "/finished");
```

Redirects to sign-in without a session. Renders the not-found page when the rule is closed.

**Client component**

```tsx
<RouteGuard path="/shipping" fallbackPath={`/${lang}/geographic-view`}>…</RouteGuard>
<AccessAllowed rule={ACCESS_RULES.taskComplete}>…</AccessAllowed>
```

## Adding a gate

1. Add the permission to `PERMISSIONS` and the rule to `ACCESS_RULES`.
2. Add the path to `ROUTE_PERMISSIONS` and call `guardPage` in the page.
3. Add `requiredPermissions` to the menu entry in `pages-config.json`.

## Alfresco groups

Groups no longer decide access to pages, menus or API routes. They are still used for:

| Use | Where |
| --- | --- |
| Task candidate groups (who can act on a workflow task) | `task-actions.tsx` via `useUserGroups` |
| Per-dashboard `allowedGroups` | `/api/dashboard/config(s)`, `home/[slug]/page.tsx` |
| User filters | `/api/user/filters` |
