# Credentials API

Reusable identities and secrets, configured once per organization and referenced from
anywhere that talks to an external system. Backs Settings › Credentials in miot-app.

## Why it exists

Before this, a credential belonged to whatever used it. Every Alfresco data source
carried its own encrypted `clientId`/`clientSecret`, and the WhatsApp channel minted a
throwaway bearer profile inline while creating its connection. Rotating a secret meant
finding every copy. The store this API exposes —
`miot_integrations.credential_profiles`, added in V0.6.0 for integration connections —
already had the right shape; it was missing everything a human-facing screen needs.

Azure Entra client credentials came first because that is what the outbound
integration currently being built needs.

## Model

| Column | Meaning |
| --- | --- |
| `credential_type` | What the operator picked. Azure Entra and generic OAuth2 both resolve as `OAUTH2_CLIENT_CREDENTIALS`, so `auth_type` alone cannot round-trip the choice or drive a type-specific form. |
| `auth_type` | How it resolves. Derived from the type unless the caller states one — `API_KEY` cannot express "in the query string". |
| `environment` | Free text. Providers issue one pair per environment, so it is part of the credential's identity; the unique index is `(tenant, lower(name), lower(environment))`. |
| `public_config` | Everything non-secret the type needs. Never contains a secret. |
| `encrypted_secret_json` | AES-GCM, keyed by `miot.integrations.secret-key`. Never serialized. |
| `secret_version` | Bumped only on an actual rotation, so a cache keyed on it is not thrown away by an ordinary edit. |
| `last_tested_at` / `last_test_result` | A client-credentials grant can be exercised alone, so the outcome belongs to the credential rather than to a connection. Recording it deliberately does not move `updated_at`. |
| `created_by` / `updated_by` | Who last rotated a secret. |

## Endpoints

All under `/api/v1/orgs/{organizationId}/integrations/credential-profiles`
(`OrgCredentialProfilesResource`). miot-app proxies them at
`/api/admin/orgs/[orgId]/integrations/credential-profiles/**` behind
`requireOrganizationSettingsAdmin` — managing credentials means handling secrets.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/` | Each item carries `usedBy`, resolved for the whole list in one query. |
| `POST` | `/` | 400 on an invalid config or a name already taken in that environment. |
| `GET` | `/{id}` | |
| `PATCH` | `/{id}` | Partial. An absent or empty `secretConfig` keeps the stored secret and its version — the form cannot show a secret, so it submits nothing to mean "leave it alone". |
| `DELETE` | `/{id}` | Soft delete. **409 with the consumers** while referenced; `?force=true` deletes anyway. |
| `POST` | `/{id}/test` | Live grant; records the outcome. |
| `POST` | `/test` | Dry run over an unsaved config, so a wrong secret is caught before it is stored. Persists nothing. |

`/test` is one segment shallower than `/{id}/test`, so neither JAX-RS nor the Next
router has to disambiguate them.

`CreateCredentialProfileRequest` keeps `credentialType` and `environment` optional: the
WhatsApp channel predates this and posts only an `authType`. Those requests derive the
type and land in `PRODUCTION`.

## Config contract

`AZURE_ENTRA_CLIENT_CREDENTIALS`

```jsonc
{
  "publicConfig": {
    "tenantId": "…",            // directory id; the token endpoint is derived from it
    "clientId": "…",
    "scope": "api://…/.default",
    "tokenRequestFormat": "FORM", // or JSON
    "tokenUrlOverride": "…"       // optional: sovereign clouds, B2C policies
  },
  "secretConfig": { "clientSecret": "…" }
}
```

`OAUTH2_CLIENT_CREDENTIALS` is the same minus `tenantId`, plus a required `tokenUrl`.
`OAuth2CredentialConfigs` owns the mapping and the completeness check, so the tester and
anything that later resolves a credential cannot disagree about where a token comes from.

## Testing a credential

`CredentialTester` is a seam alongside `ConnectionTester`, and deliberately separate: a
connection tester probes a provider's API, while a credential is verified by asking for a
token and discarding it. Types with nothing to exercise on their own — a bare API key, a
bearer token — are reported as untestable rather than passing a check that never ran.

Failures return the OAuth `error` code and the HTTP status
(`invalid_client (HTTP 401)`). `error_description` stays server-side however useful it
looks: providers fill it with correlation ids and echoed request detail.

## Security notes

- The token endpoint is fetched by the server, so `tokenUrlOverride` is an SSRF surface.
  `OutboundUrlGuard` (shared with the GPS webhook service) checks the scheme when a URL
  is stored and resolves the host immediately before fetching. DNS rebinding remains a
  residual TOCTOU risk.
- No response carries the secret. `secretPreview` is a mask, and `summary` is the type's
  non-secret identifying value (the client id for OAuth types).
- `CredentialProfileService` is blocking; the resource resolves the tenant and the acting
  user on the event loop, where the request context is live, and hands the rest to the
  worker pool.

## Not built yet

`CredentialResolver` — `resolveAuth(tenantCode, credentialProfileId) → ResolvedAuth`,
with a token cache keyed on `(profileId, secretVersion)` honouring `expiresAt`. Nothing
consumes it until the first outbound caller exists, and the API already exposes
`secretVersion`, so adding it needs no schema or endpoint change.

Data sources are Alfresco nodes carrying their own encrypted config and do not reference
a credential profile, so `DATA_SOURCE` usages are always empty today.
