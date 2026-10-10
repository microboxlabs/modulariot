# Organization access

Who belongs to an organization and what they may do. Code: `com.microboxlabs.miot.core.iam`. Schema: `miot_iam`.

## Model

| Concept | Meaning |
|---|---|
| User | A person, matched by email; the token subject is recorded at sign-in |
| Membership | A user belongs to an organization with one base role |
| Base role | `OWNER`, `ADMIN`, `MEMBER` |
| Module role | A named set of permissions a module declares, such as `CONTROL_TOWER_OPERATOR` |
| Role binding | A principal (user, team, service account or M2M client) holds a module role on a scope |
| Scope | The organization (includes its sub-accounts), one sub-account, or one resource |
| Permission | One action, `module:resource.action`, such as `controltower:case.treat` |

| Base role | Permissions |
|---|---|
| `OWNER` | Every permission except explicit-only ones |
| `ADMIN` | Owner's, minus owner-only ones (`owners:manage`, `org:delete`, `billing:manage`) |
| `MEMBER` | `org:read`, `members:read`, plus what module roles give |

## Membership source

Each top-level organization has `membership_source`; its sub-accounts follow it.

| Value | Member when | Base role |
|---|---|---|
| `ALFRESCO` (default) | In the organization's Alfresco group, or it has none | The membership's, else `MEMBER`; an Alfresco site or group manager is `OWNER` while no owner is assigned |
| `NATIVE` | Has a membership | The membership's |

`MIOT_ORGANIZATIONS_MEMBERSHIP=native` makes every organization native, for deployments without Alfresco.

A platform owner is `OWNER` of every active organization, with either source and without a membership. `GET /api/v1/me/scopes` lists every active organization for them, so the app's organization switcher shows all of them. No membership row is written for this.

With `ALFRESCO`, and for the organization's own M2M client, a caller holding no role of a module gets that module's legacy-default role (control tower: Operator).

With `ALFRESCO`, people are added and removed in the Alfresco group. The Team page cannot invite or remove (409). An Alfresco member is recorded as a membership the first time they sign in (`GET /api/v1/me/scopes`): site and group managers as `ADMIN`, everyone else `MEMBER`. A membership row only raises the base role; it never grants access on its own.

## Signing in

Sign-in proves who the user is; there is no sign-up. A user with no organization sees a "no access yet" page listing their pending invitations. Every sign-in updates `last_seen_at`, at most every 5 minutes.

## Invitations

An invitation names an email, a base role and optional module roles. It lasts 30 days by default, 90 at most. The link `/app/{lang}/invite/{token}` is shown once; only the token's SHA-256 is stored. The invitee must sign in with the invited email. One pending invitation per email and organization. Native organizations only.

### Emailing the link

Creating or resending an invitation emails the link, in the request's `lang` (`es` default, or `en`). The email goes through the organization's `RESEND` connection, else through the platform sender (`/api/v1/platform/mail`). The link is still returned once, so the admin can copy it when the email was not sent.

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

A native organization's sub-accounts get no Alfresco group. Creating a top-level organization is for platform owners.

## Rules for changing members

- Only an owner can make or remove an owner.
- The last owner cannot be removed or demoted.
- A caller cannot grant a role holding permissions the caller lacks. Explicit-only permissions are exempt.

## Teams

A team is a named set of members. A role bound to a team applies to each of its members.

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

## Moving an organization off Alfresco

1. A platform owner calls `POST /api/v1/platform/orgs/{slug}/alfresco-import`. It copies the Alfresco group into memberships. Site and group managers become `ADMIN`; everyone else `MEMBER`. Running it again adds only new people.
2. Assign at least one `OWNER`.
3. `PATCH /api/v1/platform/orgs/{slug}/membership-source` with `{"membershipSource": "NATIVE"}`.

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
| `GET /api/v1/access/catalog` | signed in | Every permission and role, with labels |
| `GET`, `PUT /api/v1/orgs/{org}/roles/{roleCode}` | Owner or Admin (Owner for `ORGANIZATION_OWNER`) | Who holds a role; replace them |
| `GET`, `PATCH`, `DELETE /api/v1/orgs/{org}/team/members[/{userId}]` | `members:read`, `members:update`, `members:remove` | List members; change base role; remove |
| `PUT /api/v1/orgs/{org}/team/members/{userId}/roles` | `members:update` | Replace a member's module roles |
| `GET`, `POST`, `DELETE /api/v1/orgs/{org}/team/invitations[/{id}]`, `POST .../{id}/resend?lang=` | `members:invite` (`members:read` to list) | Manage invitations |
| `GET /api/v1/me/invitations`, `POST .../accept`, `POST .../{id}/accept` | signed in | The caller's pending invitations; accept by token or id |
| `GET`, `PUT`, `DELETE /api/v1/orgs/{org}/mail-templates/invitation/{lang}`, `POST .../preview` | `org:update` | The organization's invitation template. `GET` returns the one in use and its `source`. 409 on a sub-account |
| `GET`, `PUT`, `DELETE /api/v1/platform/mail-templates/invitation/{lang}`, `POST .../preview` | platform owner | The platform's invitation template |
| `/api/v1/orgs/{org}/team/teams[/{teamId}[/members]]` | `teams:manage` (`members:read` to list) | Teams and their members |
| `/api/v1/orgs/{org}/team/bindings[/{bindingId}]` | `members:update` (`members:read` to list) | Role bindings, optionally scoped to a sub-account |
| `/api/v1/orgs/{org}/team/service-accounts[/{id}[/roles\|/keys[/{keyId}]]]` | `apikeys:manage` | Service accounts, their roles and keys |
| `POST /api/v1/platform/orgs` | platform owner | Create a top-level organization (`membershipSource` optional) |
| `GET`, `PUT /api/v1/platform/orgs/{slug}/roles/{roleCode}` | platform owner | Give a new organization its first owner |
| `POST /api/v1/platform/orgs/{slug}/alfresco-import` | platform owner | Copy the Alfresco group into memberships |
| `PATCH /api/v1/platform/orgs/{slug}/membership-source` | platform owner | Switch between `ALFRESCO` and `NATIVE` |
| `GET /api/v1/platform/orgs/{slug}/alfresco-projection` | platform owner | The latest 100 projection changes |

Every change writes `miot_iam.iam_audit_event`.
