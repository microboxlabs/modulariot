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
| `POST /api/v1/platform/orgs` | platform owner | Create a top-level organization (`membershipSource` optional) |
| `GET`, `PUT /api/v1/platform/orgs/{slug}/roles/{roleCode}` | platform owner | Give a new organization its first owner |

Every change writes `miot_iam.iam_audit_event`.
