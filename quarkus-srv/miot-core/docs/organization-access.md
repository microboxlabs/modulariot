# Organization access

Who belongs to an organization and what they may do. Code: `com.microboxlabs.miot.core.iam`. Schema: `miot_iam`.

## Model

| Concept | Meaning |
|---|---|
| User | A person, matched by email; the token subject is recorded at sign-in |
| Membership | A user belongs to an organization with one base role |
| Base role | `OWNER`, `ADMIN`, `MEMBER` |
| Module role | A named set of permissions a module declares, such as `CONTROL_TOWER_OPERATOR` |
| Custom role | A named set of permissions an organization defines, with key `custom:<slug>` |
| Role binding | A principal (user, team, service account or M2M client) holds a module or custom role on a scope |
| Scope | The organization (includes its sub-accounts), one sub-account, or one resource |
| Permission | One action, `module:resource.action`, such as `controltower:case.treat` |

| Base role | Permissions |
|---|---|
| `OWNER` | Every permission except explicit-only ones |
| `ADMIN` | Owner's, minus owner-only ones (`owners:manage`, `org:delete`, `billing:manage`) |
| `MEMBER` | `org:read`, `members:read`, plus what module roles give |

## Membership

A user is a member of an organization when they have an active membership of it or of its top-level organization. The base role is the membership's. Members are managed on the Team page.

A platform owner is `OWNER` of every active organization without a membership. `GET /api/v1/me/scopes` lists every active organization for them, so the app's organization switcher shows all of them. No membership row is written for this.

The organization's own M2M client holding no role of a module gets that module's legacy-default role (control tower: Operator). Users do not.

## Signing in

Sign-in proves who the user is; there is no sign-up. A user with no organization sees a "no access yet" page listing their pending invitations. Every sign-in updates `last_seen_at`, at most every 5 minutes.

## Invitations

An invitation names an email, a base role and optional module roles. It lasts 30 days by default, 90 at most. The link `/app/{lang}/invite/{token}` is shown once; only the token's SHA-256 is stored. The invitee must sign in with the invited email. One pending invitation per email and organization. Native organizations only.

### Emailing the link

Creating or resending an invitation emails the link, in the request's `lang` (`es` default, or `en`). The email goes through the organization's `RESEND` connection, else through the platform sender, the `RESEND` connection of the platform scope. The link is still returned once, so the admin can copy it when the email was not sent.

| Setting | Purpose |
|---|---|
| `miot.app.public-url` | The app's public address including its base path, e.g. `https://app.example.com/app`. Without it no email is sent. |

One request invites at most 20 people, because each email is sent while the request waits. Each created invitation carries `delivery`: `SENT` (the provider accepted it), `FAILED` (with `detail`), or `NOT_CONFIGURED`. Emails are sent after the invitation is saved; a failed email does not undo the invitation. Resend again to retry. See `miot-integrations/docs/email-channel.md`.

### Invitation template

The email is written from a Handlebars template, one per language (`es`, `en`). The first that exists is used:

1. The organization's own template (Settings › Team › Invitation email). Sub-accounts use their top-level organization's.
2. The platform's template (Settings › Platform › Invitation email).
3. The built-in template, with the ModularIoT logo.

| Variable | Value |
|---|---|
| `organization` | The organization's name |
| `inviter` | Who invited |
| `email` | The invited email |
| `link` | The link that accepts the invitation. Required. |
| `expiresAt` | The expiry date, written in the template's language |
| `logoUrl` | `{miot.app.public-url}/email/modulariot-logo.png` |

`{{value}}` is HTML-escaped in the body and not in the subject. Templates cannot load partials or call methods. A template is saved only when it renders and includes `{{link}}`. If a saved template fails to render when sending, the next one in the list is used. The plain-text part is made from the HTML.

## Organization settings

| Action | Permission, on the top-level organization |
|---|---|
| Rename, change tax id, change modules, create a sub-account | `org:update` (Owner, Admin) |
| Delete | `org:delete` (Owner) |

Sub-accounts get no Alfresco group. Creating a top-level organization is for platform owners.

## Rules for changing members

- Only an owner can make or remove an owner.
- The last owner cannot be removed or demoted.
- Only an owner or admin can make, demote, invite or remove an admin. A member who holds `members:invite`, `members:update` or `members:remove` through a role manages members only.
- A caller cannot grant a role holding permissions the caller lacks. Explicit-only permissions are exempt.
- The same rule applies to adding a member to a team (the team's roles) and to creating an API key for a service account (the account's roles).

## Teams

A team is a named set of members. A role bound to a team applies to each of its members.

## Custom roles

The top-level organization's Owner or Admin creates, edits and deletes custom roles in Settings › Team › Roles. A custom role belongs to the top-level organization. Its sub-accounts use it too.

| Field | Rule |
|---|---|
| Key | `custom:<slug>`, made from the Spanish name when the role is created. It never changes. A taken slug gets `-2`, `-3`… Module role keys are UPPER_SNAKE, so the two never match. |
| Name | Spanish required, English defaults to the Spanish one. 80 characters at most. Unique in the organization per language, ignoring case. |
| Description | Optional, per language. 500 characters at most. |
| Permissions | At least one. Each must be in the access catalog (`GET /api/v1/access/catalog`), from any module. |

The platform scope (`_platform`) has no custom roles.

| Action | Who |
|---|---|
| List | Any member (`members:read`) |
| Create, edit, delete | Owner or Admin, checked on the base role. A member who holds `members:update` through a role cannot. |
| Add a permission to a role | The caller must hold it. Explicit-only permissions are exempt. So an Admin cannot add `owners:manage`. |
| Bind a custom role | Same root-scoped rules and endpoints as a module role. A delegated Member must hold every permission it grants; only Owner/Admin may grant explicit-only permissions without holding them |

Editing a role's permissions applies to its holders on their next request. Deleting a role deletes its bindings in the same transaction and removes it from pending invitations. The response says how many bindings were removed and how many members, teams and service accounts held them.

Changes write `custom-role.created`, `custom-role.updated` and `custom-role.deleted` to `miot_iam.iam_audit_event`.

### Where custom roles resolve

| Place | Custom roles |
|---|---|
| `AccessEvaluator` | Loads the custom roles among the caller's bindings and adds their permissions. `@PermissionsAllowed` with `OrgPermission`, `McpCaller.permitted`, `GET .../me/access` and the module access endpoints (control tower, trips) all read this decision. |
| App route and menu gates | Read `GET .../me/access`, so they follow |
| Granting (`TeamRules.checkGrant`) | Members, teams, invitations, bindings and service accounts accept custom role keys of the organization |
| `GET`, `PUT /api/v1/orgs/{org}/roles/{roleCode}` | Accepts custom roles for people. M2M custom assignments return 400; their module roles remain supported. `PUT` checks root authority and preserves team/service-account bindings |
| `GET .../permissions/{code}/me`, `POST .../authorization/check`, Harness learning routes | `HARNESS_TRAINER` and the content auto-approve check pass for any role that gives `harness:train` or `content:review.autoapprove` |
| Harness | Does not read roles. It calls the modulith, which checks permissions as above. |
| Alfresco group mappings (`iam_group_role`) and the projection outbox | Module roles only. The outbox stores group membership changes, not permissions. A custom role is never projected to an Alfresco group, so it gives no BPM candidate group. Tasks still need the corresponding mapped module role until the follow-up is complete. |
| Token role mappings (`iam_token_role`) | Module roles and base roles only |
| Legacy-default roles | Module roles only |

A custom role gives only permissions the running modulith declares. A bound key whose role no longer exists gives nothing. Server app gates read current permissions without a cross-request cache, so a revoked permission stops authorizing on the next check.

Team mutations and service-account management use root permissions, even through a sub-account URL. The UI reads `GET .../team/custom-roles/management` for the root access and custom-role management affordances. A sub-account-only Admin cannot change root roles, bindings or keys.

Creating, editing and deleting a custom role lock the top-level organization's row. Binding a custom role takes a shared lock on the same row, so a role is not deleted between the check and the insert. Bound custom roles and grant authority are refreshed after the shared lock. A new role deletes any binding left with its key, so it starts with no holders.

### Operational limits of the initial release

[Issue #2620](https://github.com/microboxlabs/modulariot/issues/2620) tracks the remaining work and acceptance criteria:

- OAuth M2M clients cannot receive custom roles yet. The API rejects those assignments instead of silently combining them with legacy write defaults. API-key service accounts do support custom roles.
- BPM task candidates still need mapped module roles as described above. Review the total permissions of those additional roles.
- After changing organizations in one tab, reload the other tabs before managing access. Cross-tab synchronization of the active organization and its cached data is pending.

These limits were accepted by the owner for the initial release. They do not waive authorization checks or the CI and Sonar gates.

## Coordination roles

`REVIEWER` (Revisor) gives `coordination:kanban.view`, `coordination:finished.view` and `coordination:geographic.view`. It does not complete tasks. The full list is in `CoordinatorAccessCatalog`.

## Service accounts and API keys

A service account belongs to one organization and acts as `MEMBER` there, plus the roles bound to it. It has no access to other organizations.

Its keys look like `miot_sk_<id>_<secret>` and go in `Authorization: Bearer`. The secret is shown once; only its SHA-256 is stored. `last_used_at` is updated at most every 5 minutes.

### Exchanging a key for an OAuth token

For services that accept only OAuth tokens, link the service account to one of the organization's stored OAuth2 client_credentials credentials:

```
PUT /api/v1/orgs/{org}/team/service-accounts/{id}/token-credential   {"credentialRef": "<credential id>"}
```

A caller holding the key then gets that credential's token:

```
POST /api/v1/iam/token
Authorization: Bearer miot_sk_...
→ 200 {"access_token": "...", "token_type": "Bearer", "expires_in": 3540}
```

| Status | When |
|---|---|
| 401 | The key is unknown, revoked or expired |
| 403 | The caller did not authenticate with a key, or the account is disabled |
| 409 | No credential is linked |

The token is reused until a minute before it expires. Needs a build with `miot.component.integrations.enabled=true`.

## Auth0 applications and GPS

Each top-level organization stores its data under an Auth0 machine-to-machine client id (`tenant_client_id`). Sub-accounts use their parent's. One top-level organization per client id.

**New organization.** `POST /api/v1/platform/orgs` without `tenantClientId` creates an M2M application named `<prefix><slug>` and grants it the GPS API. If saving the organization fails, the application is deleted.

**Existing application.** `GET /api/v1/platform/auth0-clients` lists the M2M applications with the organization using each (`organization` is null when none does). Create the organization with that `tenantClientId`.

**GPS page.** `/api/v1/orgs/{org}/gps/integration`:

| Call | Permission | Returns |
|---|---|---|
| `GET` | `gps:view` | client id, audience, token and position endpoints |
| `POST /secret` | `gps:secret.read` (Owner) | the client secret, read from Auth0 |
| `POST /secret/rotate` | `gps:secret.rotate` (Owner) | a new secret; the old one stops working |

Reading and rotating the secret are recorded in the audit log. A sub-account uses its parent's application, so its secret is managed from the parent (409 on a sub-account). The platform's own Management API application is never listed, linked, revealed or rotated.

**API keys on the ingest.** On the paths in `miot.iam.api-key-own-organization-paths` (default `/api/v1/asset/track`), a key acts in its service account's organization and stores positions under its client id. The ingest needs the `GPS_PUBLISHER` role (`gps:track.write`) on the service account. Tokens issued for the Auth0 client work as before.

**API keys on the GPS publisher.** The publisher accepts only tokens, so it exchanges a `miot_sk_` key at `POST /api/v1/iam/token`. A service account with a linked token credential gets that credential's token. One without, that has `gps:track.write`, gets a token for its organization's Auth0 application: the modulith reads the application's secret from Auth0 and asks the caching token endpoint (`MIOT_GPS_EXCHANGE_TOKEN_URL`) for the token, never Auth0 directly. The token is reused until a minute before it expires. Without that permission the exchange returns 409.

| Variable | Purpose |
|---|---|
| `AUTH0_MANAGEMENT_DOMAIN`, `AUTH0_MANAGEMENT_CLIENT_ID`, `AUTH0_MANAGEMENT_CLIENT_SECRET` | Management API application. Scopes: `create:clients`, `read:clients`, `read:client_keys`, `update:client_keys`, `delete:clients`, `create:client_grants` |
| `AUTH0_MANAGEMENT_CLIENT_NAME_PREFIX` | Prefix of new application names |
| `MIOT_GPS_AUDIENCE` | API granted to new applications. Default: `AUTH0_HS256_AUDIENCE` |
| `MIOT_GPS_SCOPES` | Scopes granted. Default: `asset:track:write` |
| `MIOT_GPS_TOKEN_URL`, `MIOT_GPS_TRACK_URL`, `MIOT_GPS_KEY_TRACK_URL` | Endpoints shown on the GPS page. `MIOT_GPS_KEY_TRACK_URL` defaults to `MIOT_GPS_TRACK_URL` |
| `MIOT_GPS_EXCHANGE_TOKEN_URL` | Caching token endpoint for API key exchanges. Default: `MIOT_GPS_TOKEN_URL` |

Without the Management variables, organizations need a `tenantClientId` and the secret cannot be read or rotated.

## Organizations that used Alfresco membership

Organizations used to take their members from their Alfresco group (`membership_source = 'ALFRESCO'`). A job moves each one that is left, a second after start and then every minute (`miot.iam.native-migration.every`):

1. Imports the top-level Alfresco group. Site and group managers become `ADMIN`, or `OWNER` when the organization has no owner; everyone else `MEMBER`. Existing memberships keep their role. Memberships recorded from Alfresco for people no longer in the group are suspended.
2. Binds each module's legacy-default role to members who hold no role of that module.
3. Marks the organization `NATIVE`.

With `MIOT_ORGANIZATIONS_MEMBERSHIP=native` or `MIOT_ALFRESCO_AUTH=stub`, organizations are only marked `NATIVE`. An organization with a sub-account that has its own Alfresco group is left pending. A scheduled run has no caller, so it reads Alfresco with the Basic credentials.

An organization not done within `miot.iam.native-migration.timeout` (default `5m`, must be positive) counts as failed: the run logs the organization and the error and the next run tries again. Alfresco members and their roles are read before opening a transaction. Import, default bindings and the switch to `NATIVE` then share one transaction, which rechecks the organization after taking its advisory lock. A control connection is reserved before that transaction, so a timeout can use `pg_terminate_backend` (Postgres 14 or later) even when the application pool is full. The flush is drained before rollback, including when termination fails; queued inserts cannot run after rollback and auto-commit. Active statements, lock waits and idle transactions have transaction-local database timeouts. Manual and scheduled callers on one pod share a run.

Readiness (`native-membership-migration`) starts down and reads cached state without acquiring a database connection. Completed migrations and a scheduled observer refresh that state every `miot.iam.native-migration.every` (default `1m`), including on API pods where migration is disabled. A failed refresh sets readiness down. Newly pending organizations, including work owned by another pod, are reflected on the next refresh. `POST /api/v1/platform/orgs/native-migration` runs migration at once and returns each organization's result, with `error` set when it failed.

The primary reactive pool keeps its production default of 20 connections for the API and symptom-engine pods; dev and test default to 10. Set `MIOT_DB_REACTIVE_MAX_SIZE=10` explicitly for a 20-slot SESSION pooler: together with the JDBC maximum of 5 this leaves capacity for other clients and operational access. The reactive limit includes LISTEN and migration control connections, and unused connections expire after 60 seconds. Returning a connection to the application pool does not release a SESSION pooler's server slot. Size production pools against their workload and pooler capacity before lowering the limit.

To keep the Alfresco group in step afterwards (BPM pooled tasks, document permissions), set `miot.iam.alfresco-projection.enabled=true`. Adding or removing a member then queues a change in `miot_iam.iam_projection_outbox`. A job sends pending changes every `miot.iam.alfresco-projection.every` (default `30s`) and gives up after 10 failures.

## Declaring permissions in a module

1. Add an `AccessCatalog` bean with the module's `PermissionDef`s and `RoleDef`s. Keys are validated at startup.
2. Annotate each endpoint:

```java
@PermissionsAllowed(value = MyCatalog.EDIT, permission = OrgPermission.class, params = "organizationId")
```

3. In MCP tools, use `McpCaller.permitted(organization, permission)`.

`AccessEvaluator` makes every decision, once per request.

## API

| Method and path | Who | Purpose |
|---|---|---|
| `GET /api/v1/orgs/{org}/me/access` | member | The caller's base role, module roles and permissions |
| `GET /api/v1/access/catalog` | signed in | Every permission and module role, with labels. Custom roles are not in it |
| `GET`, `PUT /api/v1/orgs/{org}/roles/{roleCode}` | Owner or Admin (Owner for `ORGANIZATION_OWNER`) | Who holds a role; replace them |
| `GET`, `PATCH`, `DELETE /api/v1/orgs/{org}/team/members[/{userId}]` | `members:read`, `members:update`, `members:remove` | List members; change base role; remove |
| `PUT /api/v1/orgs/{org}/team/members/{userId}/roles` | `members:update` | Replace a member's module roles |
| `GET`, `POST`, `DELETE /api/v1/orgs/{org}/team/invitations[/{id}]`, `POST .../{id}/resend?lang=` | `members:invite` (`members:read` to list) | Manage invitations |
| `GET /api/v1/me/invitations`, `POST .../accept`, `POST .../{id}/accept` | signed in | The caller's pending invitations; accept by token or id |
| `GET`, `PUT`, `DELETE /api/v1/orgs/{org}/mail-templates/invitation/{lang}`, `POST .../preview` | `org:update` | The organization's invitation template. `GET` returns the one in use and its `source`. 409 on a sub-account |
| `GET`, `PUT`, `DELETE /api/v1/platform/mail-templates/invitation/{lang}`, `POST .../preview` | platform owner | The platform's invitation template |
| `/api/v1/orgs/{org}/team/teams[/{teamId}[/members]]` | `teams:manage` (`members:read` to list) | Teams and their members |
| `/api/v1/orgs/{org}/team/bindings[/{bindingId}]` | `members:update` (`members:read` to list) | Role bindings, optionally scoped to a sub-account |
| `GET /api/v1/orgs/{org}/team/custom-roles` | `members:read` | Custom roles, with permissions and holder counts |
| `POST /api/v1/orgs/{org}/team/custom-roles`, `PUT`, `DELETE .../{roleId}` | Owner or Admin | Create (`{label: {es, en}, description: {es, en}, permissions: []}`), replace, delete. `DELETE` returns `{key, removedBindings, holders}`. 400 unknown permission, 403 not allowed, 409 name taken |
| `/api/v1/orgs/{org}/team/service-accounts[/{id}[/roles\|/keys[/{keyId}]]]` | `apikeys:manage` | Service accounts, their roles and keys |
| `POST /api/v1/platform/orgs` | platform owner | Create a top-level organization |
| `GET`, `PUT /api/v1/platform/orgs/{slug}/roles/{roleCode}` | platform owner | Give a new organization its first owner |
| `POST /api/v1/platform/orgs/native-migration` | platform owner | Move the organizations left on Alfresco membership now |
| `GET /api/v1/platform/orgs/{slug}/alfresco-projection` | platform owner | The latest 100 projection changes |

Every change writes `miot_iam.iam_audit_event`.
