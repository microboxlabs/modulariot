# Plan: Settings module — multi-tenancy, group management, module entitlements

## Goal

Add a settings admin module so that administrators of a parent site (e.g. `gama-mobility`) can:

1. Create and manage **sub-accounts** (child organizations) and associate them to a **tax id** (Chilean RUT, e.g. `77856310-K`, or another international tax id format in future deployments).
2. Assign existing Alfresco users to those sub-accounts (e.g. enroll `cris` to `TRAZA`).
3. Toggle which **application modules** each sub-account has access to (FLEET_MANAGEMENT, DASHBOARDS, COLLABORATORS_MANAGEMENT).

And — downstream — have Next.js server route handlers know the caller's active organization and inject the corresponding `cust_account` filter into pgrest queries for fleet-management and collaborators-management.

## Why this design

The backend already has most of the primitives:

- `miot_core.tenants` (V0.1.0) and `miot_core.organizations` (V0.1.1) exist.
- `organizations.alfresco_group_id` already binds an org to an Alfresco group.
- `organizations` already supports parent/child hierarchy (V0.1.2) — this IS the "site + sub-account" model.
- `OrganizationRequestFilter` already enforces Alfresco group membership (via the `IAlfrescoMembershipClient` stub).
- `effectiveClientIds` already handles "parent org sees all child org data".
- GAMA is already seeded (`gama-mobility.sql`) with `GROUP_GAMA_MOBILITY`.

What's missing:

- **Organization `tax_id`** column on `organizations` — needed to filter pgrest by `cust_account`. Kept intentionally generic (Chilean RUT today, other national tax ids later).
- **Module entitlements** table — today, module access is hardcoded as Alfresco groups in `features/layout/models/pages.ts` (`GROUP_FLEET_MANAGEMENT`, etc.), which conflates "user belongs to tenant" with "tenant has purchased this product".
- **Write-side** Alfresco admin client — the existing `IAlfrescoMembershipClient` is read-only stub. Need `createGroup`, `addGroupMember`, `removeGroupMember`, `searchPeople`.
- **`GET /api/v1/me/scopes`** — a single endpoint that returns the caller's resolved org(s), effective tax ids, and enabled modules. This is the bridge between Alfresco authorities and pgrest filtering.
- **Admin UI** in the settings page.
- **Top-nav org switcher** so users with multi-org access can pick an active org (stored in a httpOnly cookie).

### Why NOT use Alfresco zones

Alfresco zones categorize authorities (e.g. `APP.DEFAULT`) but don't provide tenant isolation. The existing organization hierarchy + `alfresco_group_id` is a cleaner and already-wired abstraction. Skip zones.

### Why NOT use nested Alfresco subgroups for module entitlements

One tempting design (hinted in the original request) is to create `GROUP_TRAZA_FLEET_MANAGEMENT` nested under `GROUP_TRAZA` and check transitively. Rejected because:

- Alfresco group count explodes (N orgs × M modules).
- Toggling access becomes a group mutation instead of a simple row update.
- Auditing "who has what" requires group traversal.
- Harder to cache / invalidate.

A dedicated `organization_modules` table is single-source-of-truth and fast to check.

## Conceptual mapping

| User vocabulary | System concept |
|---|---|
| Site / client account (GAMA) | `miot_core.organizations` with `parent_id = null` |
| Sub-account (TRAZA) | `miot_core.organizations` with `parent_id = <gama.id>` |
| Alfresco group binding | `organizations.alfresco_group_id` (already exists) |
| Customer tax id (Chilean RUT `77856310-K`, or international equivalent) | new `organizations.tax_id` column |
| User "belongs to TRAZA" | user is member of Alfresco group `GROUP_TRAZA` |
| Module access | new `miot_core.organization_modules` table |

## The "colaborators" typo

Confirmed typo in frontend code (English "collaborators"). Blast radius ~25 files:

- `features/colaborators-management/` folder
- `app/[lang]/(secured)/colaborators-management/` route folder
- i18n key `colaboratorsManagement` (en.json, es.json)
- `requiredGroups: ["GROUP_COLABORATORS_MANAGEMENT"]` in `features/layout/models/pages.ts`
- Imports across 20+ files

The API route `src/app/api/collaborators/` is already spelled correctly.

**Fix as isolated Phase 0** (per the "one phase at a time" working agreement). Keep a short-lived compat check for both the old and new group names for one release.

## Data model changes (quarkus-srv)

New migration `miot-core/src/main/resources/db/migration/core/V0.1.3__add_org_customer_and_modules.sql`:

```sql
ALTER TABLE miot_core.organizations
  ADD COLUMN tax_id VARCHAR(32),           -- normalized by pluggable validator (see MIOT_TAX_ID_VALIDATOR)
  ADD COLUMN display_name VARCHAR(200),
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX ux_org_tax_id
  ON miot_core.organizations (tax_id) WHERE tax_id IS NOT NULL;

CREATE TABLE miot_core.organization_modules (
  organization_id BIGINT NOT NULL REFERENCES miot_core.organizations(id) ON DELETE CASCADE,
  module_code VARCHAR(64) NOT NULL,   -- FLEET_MANAGEMENT, DASHBOARDS, COLLABORATORS_MANAGEMENT
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, module_code)
);
```

No backfill in V0.1.3: GAMA and its children keep `tax_id = NULL` until admins populate them via the settings UI.

## Backend API surface (Quarkus)

Replace the stub `IAlfrescoMembershipClient` with a real client and add write operations under a new interface `IAlfrescoGroupAdminClient`:

```
createGroup(id: String, displayName: String) : void
addGroupMember(groupId: String, personId: String) : void
removeGroupMember(groupId: String, personId: String) : void
listGroupMembers(groupId: String, paging) : List<Person>
searchPeople(query: String, limit: int) : List<Person>
```

Backed by Alfresco REST (`/alfresco/api/-default-/public/alfresco/versions/1/groups` and `/people`).

New REST endpoints (admin-scoped via existing `OrganizationRequestFilter`):

```
GET    /api/v1/me/scopes                                 <-- key endpoint for Next.js
GET    /api/v1/orgs/{orgId}/children
POST   /api/v1/orgs/{orgId}/children                     (create sub-account — Ex2)
PATCH  /api/v1/orgs/{orgId}
DELETE /api/v1/orgs/{orgId}                              (soft delete)

GET    /api/v1/orgs/{orgId}/members
POST   /api/v1/orgs/{orgId}/members                      (assign user — Ex1)
DELETE /api/v1/orgs/{orgId}/members/{personId}

GET    /api/v1/orgs/{orgId}/modules
PUT    /api/v1/orgs/{orgId}/modules                      (set enabled modules — Ex3)

GET    /api/v1/people?q=...                              (admin-only people search)
```

`GET /api/v1/me/scopes` response:

```json
[
  {
    "organizationId": 1,
    "slug": "gama-mobility",
    "displayName": "GAMA Mobility",
    "taxId": null,
    "role": "SITE_MANAGER",
    "isParent": true,
    "effectiveTaxIds": ["77856310-K", "96123456-7"],
    "modules": ["FLEET_MANAGEMENT","DASHBOARDS","COLLABORATORS_MANAGEMENT"]
  },
  {
    "organizationId": 7,
    "slug": "traza",
    "displayName": "Traza",
    "taxId": "77856310-K",
    "role": "SITE_COLLABORATOR",
    "isParent": false,
    "effectiveTaxIds": ["77856310-K"],
    "modules": ["FLEET_MANAGEMENT","COLLABORATORS_MANAGEMENT"]
  }
]
```

Note: parent orgs (GAMA) have `taxId = null`; only child orgs (TRAZA, SomeCo, …) carry a tax id. For a parent, `effectiveTaxIds` is the union of all child `tax_id`s. For a child, it's a single-element array.

Authorization for write ops: caller must have `SITE_MANAGER` / `GROUP_ADMIN` on the *parent* org. GAMA admins can manage TRAZA; TRAZA admins cannot manage GAMA.

## Tenant scope resolution in Next.js routes

New helper `turbo-repo/apps/app/src/app/api/utils/tenant-scope.ts`:

```ts
export type TenantScope = {
  activeOrg: {
    id: number;
    slug: string;
    displayName: string;
    taxId: string | null;
    modules: ModuleCode[];
  };
  availableOrgs: Array<{ id: number; slug: string; displayName: string; taxId: string | null }>;
  effectiveTaxIds: string[];
};

export async function resolveTenantScope(req: NextRequest): Promise<TenantScope>;
export function requireModule(scope: TenantScope, code: ModuleCode): void; // throws 403
```

Flow:

1. Call Quarkus `/api/v1/me/scopes` with the session's Alfresco ticket / Auth0 JWT.
2. Pick active org from httpOnly cookie `miot_active_org` (slug). Default: user's single org, or parent org if user is a GAMA admin.
3. For parent orgs, `effectiveTaxIds` is the union of all child orgs' `tax_id`. For child orgs, it's a single-element array.
4. Cache per `session.user.id + activeOrg` for a short TTL (e.g. 60s) to avoid hammering Quarkus on every request.

Extend `pgrest-client.ts` functions to accept `custAccounts: string[]` and inject:

```
cust_account=eq.<rut>                 (single)
cust_account=in.(<rut1>,<rut2>,...)   (multiple)
```

Routes to update (Phase 2, after scope infra):

- `src/app/api/collaborators/route.ts`
- `src/app/api/collaborators/[codDriver]/route.ts` (also enforce the returned row's `cust_account` is in scope — 403 otherwise)
- `src/app/api/fleet/trucks/route.ts` and any other fleet route that reads `v_modulariot_*` or calls `fn_dx_uso_flota_detalle`

**Cache key update:** current route caches key on `userId:query`. Change to `userId:activeOrgSlug:query` so switching org doesn't return stale data.

## Top-nav org switcher

Add to the secured layout navbar. Shows current org with parent badge when applicable (e.g. "GAMA MOBILITY › TRAZA"). Clicking:

1. Sets `miot_active_org` cookie (httpOnly, secure, SameSite=Lax).
2. Invalidates SWR caches.
3. Refreshes the route.

If the user has exactly one org in `/me/scopes`, hide the switcher.

## Frontend settings module structure

Following the existing feature folder convention (`features/<name>/{types,components,hooks,data}/`) and extending the existing settings page at `src/app/[lang]/(secured)/users/settings/`.

```
features/settings-admin/
├── types/
│   └── settings-admin.types.ts
├── components/
│   ├── settings-admin-page.tsx
│   ├── orgs/
│   │   ├── orgs-section.tsx
│   │   ├── org-card.tsx
│   │   ├── org-create-dialog.tsx       (Ex2)
│   │   └── org-edit-dialog.tsx
│   ├── members/
│   │   ├── members-section.tsx
│   │   ├── people-search.tsx
│   │   └── assign-member-dialog.tsx    (Ex1)
│   └── modules/
│       └── modules-section.tsx         (Ex3)
├── hooks/
│   ├── use-orgs.ts
│   ├── use-org-members.ts
│   ├── use-people-search.ts
│   └── use-org-modules.ts
└── data/
    └── settings-admin-data-service.ts
```

No barrel / `index.ts` files (project convention).

Next.js route handlers under `src/app/api/admin/orgs/**` proxy to the Quarkus admin endpoints. **Don't call Alfresco directly from Next** — Quarkus is the authz boundary and already has `OrganizationRequestFilter`.

New page route: `src/app/[lang]/(secured)/users/settings/organizations/page.tsx`. Add to the existing `SettingsSidebar`. Gate it behind a new `canManageOrg(scope)` helper (admin role on the active org, which must be a parent or the user must be a system admin).

## Module entitlements: retire `requiredGroups` for product modules

Today `features/layout/models/pages.ts` does:

```ts
{ href:"/fleet-management",          requiredGroups:["GROUP_FLEET_MANAGEMENT"] }
{ href:"/colaborators-management",   requiredGroups:["GROUP_COLABORATORS_MANAGEMENT"] }
```

Replace with:

```ts
{ href:"/fleet-management",          requiredModule:"FLEET_MANAGEMENT" }
{ href:"/collaborators-management",  requiredModule:"COLLABORATORS_MANAGEMENT" }
```

And `features/auth/config/route-permissions.ts` consults `scope.activeOrg.modules` via `hasModule(scope, code)`.

Keep `requiredGroups` only for cross-cutting system roles like `GROUP_ALFRESCO_ADMINISTRATORS`, `GROUP_MINTRAL_SYSTEM_ADMIN`.

## End-to-end flows

### Ex1 — Assign Cris to TRAZA

1. Admin opens Settings › Organizations › TRAZA › Members.
2. Types "Cris" in the people search → `/api/admin/people?q=cris` → Quarkus → Alfresco `/people?where=...`.
3. Selects "Cris Pérez" → "Add to TRAZA".
4. `POST /api/admin/orgs/{trazaId}/members { personId:'cris.perez' }` → Quarkus → Alfresco `addGroupMember(GROUP_TRAZA, cris.perez)`.
5. Next time Cris makes a request, `/me/scopes` includes TRAZA with `taxId=77856310-K`, and pgrest queries are filtered.

### Ex2 — Create sub-account for SomeCo

1. Admin opens Settings › Organizations › "New sub-account".
2. Form: Name (SomeCo), Slug (auto `someco`), Tax ID (`96123456-7`, validated by the pluggable `MIOT_TAX_ID_VALIDATOR`), Parent = GAMA (pre-filled).
3. `POST /api/admin/orgs/{gamaId}/children`.
4. Quarkus creates the row, creates `GROUP_SOMECO` in Alfresco, sets `alfresco_group_id`, default-disables modules (admin must enable them explicitly).

### Ex3 — Grant FLEET + DASHBOARDS to SomeCo

1. Settings › Organizations › SomeCo › Access.
2. Checkbox grid of modules.
3. `PUT /api/admin/orgs/{somecoId}/modules { modules:['FLEET_MANAGEMENT','DASHBOARDS'] }`.
4. Quarkus upserts `organization_modules` rows.
5. SomeCo users now see the updated `modules` in `/me/scopes`, and the sidebar renders accordingly.

## Phasing

Each phase independently shippable and reversible. Work one phase at a time.

### Phase 0 — "Colaborators" typo fix (isolated)

- Rename `features/colaborators-management/` → `features/collaborators-management/`.
- Rename `app/[lang]/(secured)/colaborators-management/` → `collaborators-management/`.
- Rename i18n keys `colaboratorsManagement` → `collaboratorsManagement`.
- Rename group constant `GROUP_COLABORATORS_MANAGEMENT` → `GROUP_COLLABORATORS_MANAGEMENT`, keep compat check on both for one release.
- No functional changes.

### Phase 1 — Backend data model & read APIs

- Migration V0.1.3: `tax_id`, `organization_modules`.
- Real `IAlfrescoGroupAdminClient` (read ops only: list members, search people).
- `GET /api/v1/me/scopes`, `GET /orgs/{id}/members`, `GET /orgs/{id}/modules`, `GET /people?q=...`.
- Seed existing orgs with known customer RUTs.

### Phase 2 — Tenant scope in Next.js + filtered pgrest

- `resolveTenantScope` helper + `miot_active_org` cookie.
- Top-nav org switcher.
- Apply `cust_account` filter in collaborators and fleet routes.
- Update cache keys to include active org slug.
- Add `hasModule(scope, code)` guard (keep `requiredGroups` as fallback).

### Phase 3 — Settings admin UI (read-only)

- Settings › Organizations page: list orgs, list members, list modules.
- Proxies to Quarkus read endpoints.

### Phase 4 — Backend write APIs

- Add member, remove member (Alfresco mutations).
- Create sub-account (org row + Alfresco group creation).
- `PUT /orgs/{id}/modules`.
- Edit / soft-delete org.
- Authz checks (parent-admin role required for writes).

### Phase 5 — Settings admin UI (write — the three flows)

- `assign-member-dialog` (Ex1).
- `org-create-dialog` (Ex2).
- `modules-section` toggles (Ex3).
- Edit / rename flows.

### Phase 6 — Retire legacy `requiredGroups` for product modules

- Switch `pages.ts` and `route-permissions.ts` to `requiredModule`.
- Remove the compat dual-check from Phase 0.
- Document the new mental model in project docs.

## Decisions (resolved before Phase 1)

1. **tax_id source of truth.** Editable via the admin UI. Validation is **pluggable via an environment variable** (e.g. `MIOT_TAX_ID_VALIDATOR=chilean_rut`) so the format can be swapped per deployment region. A `ChileanRutValidator` implementation ships first (checksum on the trailing `-K`/digit).
2. **One org = one tax_id.** Confirmed 1:1. Keep the unique index on `organizations.tax_id WHERE tax_id IS NOT NULL`.
3. **Parent vs. child semantics.** **Parent organizations are site-level containers that hold multiple client sub-accounts.** GAMA itself is not a customer — TRAZA, SomeCo, etc. are. Consequences:
   - `tax_id` on parent orgs stays `NULL`; only child sub-accounts carry a tax id.
   - pgrest tenant filtering uses child `tax_id`s via `effectiveTaxIds[]` (parent resolves to union of its children).
   - Module entitlements on a parent org represent the "ceiling" of what sub-accounts can be granted. *(Assumption to confirm during Phase 1: new sub-accounts start with **no modules enabled** — admin grants explicitly per client.)*
4. **Who can create sub-accounts.** Users with Alfresco **SITE_MANAGER** role on the parent site/org. System admins (`GROUP_ALFRESCO_ADMINISTRATORS` / `GROUP_MINTRAL_SYSTEM_ADMIN`) retain full access. Role is determined via the existing `IAlfrescoMembershipClient.getRole()` call against the parent org's `alfresco_group_id`.
5. **Field naming.** `tax_id` on `miot_core.organizations` (not `customer_rut` / `customer_tax_id`). Kept generic for international use.
6. **Backfill.** Do **not** backfill existing seeded orgs in the V0.1.3 migration. Leave `tax_id` as `NULL` for GAMA and its children; admin will populate via the UI once known.

## File paths touched (high level)

Backend:
- `quarkus-srv/miot-core/src/main/resources/db/migration/core/V0.1.3__add_org_customer_and_modules.sql` (new)
- `quarkus-srv/miot-core/src/main/java/com/microboxlabs/miot/core/alfresco/IAlfrescoGroupAdminClient.java` (new)
- `quarkus-srv/miot-core/src/main/java/com/microboxlabs/miot/core/alfresco/AlfrescoGroupAdminClient.java` (new, real impl)
- Resource classes for `/orgs/{id}/members`, `/orgs/{id}/modules`, `/orgs/{id}/children`, `/me/scopes`, `/people`.

Frontend:
- `turbo-repo/apps/app/src/app/api/utils/tenant-scope.ts` (new)
- `turbo-repo/apps/app/src/app/api/utils/pgrest-client.ts` (extend filters)
- `turbo-repo/apps/app/src/app/api/collaborators/route.ts` (apply scope)
- `turbo-repo/apps/app/src/app/api/collaborators/[codDriver]/route.ts` (enforce scope)
- `turbo-repo/apps/app/src/app/api/fleet/trucks/route.ts` (apply scope)
- `turbo-repo/apps/app/src/app/api/admin/orgs/**` (new proxy routes)
- `turbo-repo/apps/app/src/app/api/admin/people/route.ts` (new)
- `turbo-repo/apps/app/src/app/[lang]/(secured)/users/settings/organizations/page.tsx` (new)
- `turbo-repo/apps/app/src/features/settings-admin/**` (new feature folder)
- `turbo-repo/apps/app/src/features/layout/components/secured-navbar/org-switcher.tsx` (new)
- `turbo-repo/apps/app/src/features/layout/models/pages.ts` (swap `requiredGroups` → `requiredModule` in Phase 6)
- `turbo-repo/apps/app/src/features/auth/config/route-permissions.ts` (add `hasModule`)
- `turbo-repo/apps/app/src/lang/{en,es}.json` (typo fix + new settings keys)
