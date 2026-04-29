# miot-cli Connections Module Reference

## Table of Contents

- [Global Options](#global-options)
- [connections list](#miot-connections-list)
- [connections get](#miot-connections-get)
- [connections create](#miot-connections-create)
- [connections test](#miot-connections-test)
- [profiles list](#miot-connections-profiles-list)
- [profiles create](#miot-connections-profiles-create)
- [operations list](#miot-connections-operations-list)
- [operations create](#miot-connections-operations-create)

---

## Global Options

These flags apply to every `miot` command:

| Flag | Type | Description |
|------|------|-------------|
| `--base-url <url>` | string | ModularIoT API base URL (or `MIOT_BASE_URL` env) |
| `--token <token>` | string | Auth token (or `MIOT_TOKEN` env) |
| `--organization <id>` | string | Organization ID (or `MIOT_ORGANIZATION_ID` env) |
| `--profile <name>` | string | Named profile from `~/.miotrc.json` |
| `--output <mode>` | `json` \| `table` | Output format (default: `table` in TTY, `json` when piped) |

Dotfile profile shape:

```json
{
  "defaultProfile": "staging",
  "profiles": {
    "staging": {
      "baseUrl": "https://api.example.com",
      "token": "token",
      "organizationId": "org-1"
    }
  }
}
```

---

## miot connections list

List integration connections.

```bash
miot connections list --output json
```

**JSON output:**

```json
[
  {
    "id": "conn-1",
    "tenantCode": "tenant-1",
    "name": "Fleet PostgREST",
    "providerType": "POSTGREST",
    "baseUrl": "https://postgrest.example.com",
    "credentialProfileId": "profile-1",
    "status": "ACTIVE",
    "lastTestedAt": "2026-04-28T20:00:00Z",
    "lastTestResult": true,
    "metadata": { "service": "fleet" }
  }
]
```

---

## miot connections get

`miot connections get <id>`

Get a single integration connection.

**JSON output:** Same object shape as an item from `connections list`.

---

## miot connections create

Create an integration connection.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | yes | Connection name |
| `--provider <type>` | enum | yes | `POSTGREST`, `ALERCE_TMS`, `N8N`, `AUTH0`, `ECM`, or `CUSTOM_HTTP` |
| `--provider-base-url <url>` | URI string | yes | External provider base URL |
| `--credential-profile <id>` | string | yes | Credential profile ID |
| `--metadata-json <json>` | JSON object | no | Connection metadata |

Example:

```bash
miot connections create \
  --name "Fleet PostgREST" \
  --provider POSTGREST \
  --provider-base-url "https://postgrest.example.com" \
  --credential-profile profile-1 \
  --metadata-json '{"service":"fleet"}' \
  --output json
```

**JSON output:** Same object shape as `connections get`. New connections start with `status: "DRAFT"`.

---

## miot connections test

`miot connections test <id>`

Test an integration connection contract.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--method <method>` | string | no | HTTP method to test; server defaults to `GET` when blank |
| `--path <path>` | string | no | Provider path to test |

**JSON output:**

```json
{
  "success": true,
  "testedAt": "2026-04-28T20:00:00Z",
  "message": "Connection contract is valid for GET /health; runtime probe pending"
}
```

---

## miot connections profiles list

List credential profiles.

```bash
miot connections profiles list --output json
```

**JSON output:**

```json
[
  {
    "id": "profile-1",
    "tenantCode": "tenant-1",
    "displayName": "PostGREST bearer token",
    "authType": "BEARER_TOKEN",
    "publicConfig": {},
    "secretPreview": "****",
    "secretVersion": 1,
    "createdAt": "2026-04-28T20:00:00Z",
    "updatedAt": "2026-04-28T20:00:00Z"
  }
]
```

---

## miot connections profiles create

Create a credential profile.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--display-name <name>` | string | yes | Profile display name |
| `--auth-type <type>` | enum | yes | `NONE`, `BEARER_TOKEN`, `API_KEY_HEADER`, `API_KEY_QUERY`, `BASIC`, `OAUTH2_CLIENT_CREDENTIALS`, or `CUSTOM_HEADERS` |
| `--public-config-json <json>` | JSON object | no | Non-secret auth config |
| `--secret-config-json <json>` | JSON object | no | Secret auth config |

Example:

```bash
miot connections profiles create \
  --display-name "PostGREST bearer token" \
  --auth-type BEARER_TOKEN \
  --public-config-json '{}' \
  --secret-config-json '{"token":"secret-token"}' \
  --output json
```

**JSON output:** Same object shape as an item from `profiles list`; raw secret values are not returned.

---

## miot connections operations list

`miot connections operations list <connectionId>`

List operation contracts for a connection.

**JSON output:**

```json
[
  {
    "id": "op-1",
    "connectionId": "conn-1",
    "name": "Health check",
    "method": "GET",
    "path": "/health",
    "requestSchema": {},
    "responseSchema": {},
    "testOperation": true
  }
]
```

---

## miot connections operations create

`miot connections operations create <connectionId>`

Create an operation contract for a connection.

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name <name>` | string | yes | Operation name |
| `--method <method>` | string | yes | HTTP method |
| `--path <path>` | string | yes | Provider path |
| `--request-schema-json <json>` | JSON object | no | Request schema |
| `--response-schema-json <json>` | JSON object | no | Response schema |
| `--test-operation` | boolean | no | Mark this as the connection test operation |

Example:

```bash
miot connections operations create conn-1 \
  --name "Health check" \
  --method GET \
  --path "/health" \
  --request-schema-json '{}' \
  --response-schema-json '{}' \
  --test-operation \
  --output json
```

**JSON output:** Same object shape as an item from `operations list`.
