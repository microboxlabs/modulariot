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

With `ALFRESCO`, and for the organization's own M2M client, a caller holding no role of a module gets that module's legacy-default role (control tower: Operator).

## Invitations

An invitation names an email, a base role and optional module roles. It lasts 30 days by default, 90 at most. The link `/app/{lang}/invite/{token}` is shown once; only the token's SHA-256 is stored. The invitee must sign in with the invited email. One pending invitation per email and organization.

## Rules for changing members

- Only an owner can make or remove an owner.
- The last owner cannot be removed or demoted.
- A caller cannot grant a role holding permissions the caller lacks. Explicit-only permissions are exempt.

## Teams

A team is a named set of members. A role bound to a team applies to each of its members.

## Service accounts and API keys

A service account belongs to one organization and acts as `MEMBER` there, plus the roles bound to it. It has no access to other organizations.

Its keys look like `miot_sk_<id>_<secret>` and go in `Authorization: Bearer`. The secret is shown once; only its SHA-256 is stored. `last_used_at` is updated at most every 5 minutes.

## Moving an organization off Alfresco

1. `POST /api/v1/platform/orgs/{slug}/alfresco-import` copies the Alfresco group into memberships. Site and group managers become `ADMIN`; everyone else `MEMBER`. Running it again adds only new people.
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
| `GET`, `POST`, `DELETE /api/v1/orgs/{org}/team/invitations[/{id}]`, `POST .../{id}/resend` | `members:invite` (`members:read` to list) | Manage invitations |
| `GET /api/v1/me/invitations`, `POST .../accept`, `POST .../{id}/accept` | signed in | The caller's pending invitations; accept by token or id |
| `/api/v1/orgs/{org}/team/teams[/{teamId}[/members]]` | `teams:manage` (`members:read` to list) | Teams and their members |
| `/api/v1/orgs/{org}/team/bindings[/{bindingId}]` | `members:update` (`members:read` to list) | Role bindings, optionally scoped to a sub-account |
| `/api/v1/orgs/{org}/team/service-accounts[/{id}[/roles\|/keys[/{keyId}]]]` | `apikeys:manage` | Service accounts, their roles and keys |
| `POST /api/v1/platform/orgs` | platform owner | Create a top-level organization (`membershipSource` optional) |
| `GET`, `PUT /api/v1/platform/orgs/{slug}/roles/{roleCode}` | platform owner | Give a new organization its first owner |
| `POST /api/v1/platform/orgs/{slug}/alfresco-import` | platform owner | Copy the Alfresco group into memberships |
| `PATCH /api/v1/platform/orgs/{slug}/membership-source` | platform owner | Switch between `ALFRESCO` and `NATIVE` |
| `GET /api/v1/platform/orgs/{slug}/alfresco-projection` | platform owner | The latest 100 projection changes |

Every change writes `miot_iam.iam_audit_event`.
