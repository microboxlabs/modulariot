---
name: miot-connections
description: >
  Query and manage ModularIoT integration connections through the miot CLI.
  Use when the user asks to create or inspect external API connections,
  credential profiles, connection tests, operation contracts, provider auth,
  PostgREST/Alerce/N8N/Auth0/ECM/CUSTOM_HTTP integrations, or connection setup
  in a ModularIoT organization.
---

# ModularIoT Connections Skill

## Prerequisites

The `miot` CLI must be available. Run commands via:
- `npx @microboxlabs/miot-cli <command>` (no install needed), or
- `miot <command>` (if globally installed)

Configuration requires one of:
1. `--base-url`, `--token`, and `--organization` flags on every call
2. `MIOT_BASE_URL`, `MIOT_TOKEN`, and `MIOT_ORGANIZATION_ID` environment variables
3. A `~/.miotrc.json` profile selected with `--profile <name>`

Always add `--output json` to CLI calls and parse the JSON result.

## Domain Model

```
Organization
 └── Integration Connections
      ├── Credential Profiles  ← auth material and public auth config
      ├── Connections           ← provider base URL, provider type, status, metadata
      ├── Operations            ← method/path contracts for provider endpoints
      └── Connection Tests      ← marks a connection ACTIVE when the contract validates
```

Key relationships:
- A credential profile stores auth config separately from a connection.
- A connection references exactly one credential profile.
- Operations belong to a connection and describe provider endpoint contracts.
- Connection tests currently validate the connection contract and update the connection status.

## Common Workflows

### "List the integration connections"

```
miot connections list --output json
```

Summarize by name, provider type, status, base URL, and last test result.

### "Create a credential profile"

1. Choose an `authType`: `NONE`, `BEARER_TOKEN`, `API_KEY_HEADER`, `API_KEY_QUERY`, `BASIC`, `OAUTH2_CLIENT_CREDENTIALS`, or `CUSTOM_HEADERS`.
2. Put non-secret settings in `--public-config-json`.
3. Put secret material in `--secret-config-json`.
4. Run:
   ```
   miot connections profiles create \
     --display-name "<name>" \
     --auth-type <authType> \
     --public-config-json '<json-object>' \
     --secret-config-json '<json-object>' \
     --output json
   ```

Never print secret values back to the user. The API returns only `secretPreview`.

### "Create a connection"

1. Create or identify the credential profile:
   ```
   miot connections profiles list --output json
   ```
2. Choose a provider type: `POSTGREST`, `ALERCE_TMS`, `N8N`, `AUTH0`, `ECM`, or `CUSTOM_HTTP`.
3. Create the connection:
   ```
   miot connections create \
     --name "<name>" \
     --provider <providerType> \
     --provider-base-url "<url>" \
     --credential-profile <profileId> \
     --metadata-json '<json-object>' \
     --output json
   ```

### "Add an operation to a connection"

```
miot connections operations create <connectionId> \
  --name "<operation name>" \
  --method GET \
  --path "/health" \
  --request-schema-json '{}' \
  --response-schema-json '{}' \
  --test-operation \
  --output json
```

Use `--test-operation` for the operation intended to represent a health check or probe.

### "Test a connection"

```
miot connections test <connectionId> --method GET --path "/health" --output json
```

If successful, the connection status becomes `ACTIVE` and `lastTestResult` becomes `true`.

### "Show the complete setup for a connection"

1. Get the connection:
   ```
   miot connections get <connectionId> --output json
   ```
2. List its operations:
   ```
   miot connections operations list <connectionId> --output json
   ```
3. If credential profile details are needed, list profiles and match by `credentialProfileId`.

## Error Handling

CLI errors return `{ "error": { "status": N, "message": "..." } }` or `{ "error": { "message": "..." } }`.

Common cases:

| Code | Meaning |
|------|---------|
| 400  | Invalid request body, URL, provider type, auth type, or JSON flag |
| 403  | Organization context does not match the request path |
| 404  | Connection or credential profile not found |
| 500  | Server or integration service failure |

Explain the error in plain language and suggest the next command to inspect state.

## Business Rules

- Organization is required for all `connections` commands. Use `--organization`, `MIOT_ORGANIZATION_ID`, or a profile with `organizationId`.
- Supported provider types: `POSTGREST`, `ALERCE_TMS`, `N8N`, `AUTH0`, `ECM`, `CUSTOM_HTTP`.
- Supported auth types: `NONE`, `BEARER_TOKEN`, `API_KEY_HEADER`, `API_KEY_QUERY`, `BASIC`, `OAUTH2_CLIENT_CREDENTIALS`, `CUSTOM_HEADERS`.
- JSON flags must be JSON objects, not arrays or scalar values.
- Treat `secretConfig` values as sensitive. Do not echo, log, or summarize raw secrets.
- Use `--provider-base-url` for the external provider URL. `--base-url` is the ModularIoT API base URL.
- A new connection starts as `DRAFT`; successful test changes it to `ACTIVE`.

## Full CLI Reference

For the complete list of commands, flags, and JSON output shapes, read [references/reference.md](references/reference.md).
