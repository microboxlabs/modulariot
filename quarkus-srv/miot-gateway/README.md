# miot-gateway

Routing gateway component for the ModularIoT modulith. Provides body-aware traffic forking that APISIX cannot express natively — APISIX mirrors requests here, and the gateway decides where (and whether) to forward them based on the request body content.

The gateway is structured as a set of **fork sub-modules**. The first is the **fork engine**: a configurable rules engine that matches incoming paths, extracts a routing key from the request body (JSON or CSV), checks an in-memory filter, and fans out matching requests to one or more upstream targets.

```
APISIX  ──proxy-mirror──►  miot-gateway  ──forwardAsync──►  target-A
                                │                    └──────────────►  target-B
                                └── no match / not in filter → discard (200)
```

---

## Getting Started

### Local development

```bash
# From quarkus-srv/
./start.sh gateway
```

The gateway requires no database. It starts in under a second and immediately begins accepting mirror traffic. No fork rules are loaded until you configure them.

To start with a rule active, create a local `application.properties` override or pass properties directly:

```bash
./start.sh gateway -- \
  -Dfork.enabled=true \
  -D"fork.rules[0].id=asset-track-canary" \
  -D"fork.rules[0].paths[0]=/v1/asset/track" \
  -D"fork.rules[0].filter-file=./dev-assets.txt" \
  -D"fork.rules[0].targets[0].id=storm" \
  -D"fork.rules[0].targets[0].mirror-host=https://storm.modulariot.com" \
  -D"fork.rules[0].targets[0].mirror-path=/v1/asset/track"
```

Create `dev-assets.txt`:

```
# Asset IDs to forward during local testing
SVSX88
ABC123
```

Send a test request:

```bash
curl -s -X POST http://localhost:8180/v1/asset/track \
  -H "Content-Type: application/json" \
  -d '{"asset_id":"SVSX88","lat":-33.4489,"lng":-70.6693}'
# → 200 OK (always — gateway never rejects APISIX mirror traffic)
```

Inspect the loaded filter:

```bash
curl http://localhost:8180/internal/fork/rules/asset-track-canary/filter
# → ["SVSX88", "ABC123"]
```

### Kubernetes deployment

The gateway runs as a **separate deployment** from the production backend, using the same container image built by CI.

> **How the single-image model works in Quarkus**
>
> Quarkus `@IfBuildProperty` is evaluated at **Maven build time**, not at container start. CI builds with all component flags set to `true`, so every component's code (endpoints, services) is compiled into the single image.
>
> At runtime, `MIOT_COMPONENT_GATEWAY_ENABLED` controls `@LookupIfProperty` on `GatewayComponent`, which determines whether the component's lifecycle (`onStart`, `onStop`) runs. It does **not** unregister REST endpoints — those are baked in.
>
> In practice this is safe:
> - In a **gateway pod**: `ForkMirrorResource` receives APISIX mirror traffic. Other components' endpoints (e.g. `/api/v1/asset/track`) are registered but never called — APISIX does not route to them via the gateway ClusterIP.
> - In a **production pod**: `ForkMirrorResource`'s catch-all exists but returns `200` immediately for any unmatched path (the fork rule index is empty when `fork.enabled=false`).
>
> If you need strict isolation (no cross-component endpoints), build a dedicated gateway image with only `miot.component.gateway.enabled=true`.

```yaml
# deployment.yaml
env:
  - name: MIOT_COMPONENT_GATEWAY_ENABLED
    value: "true"
  - name: FORK_ENABLED
    value: "true"

# Mount fork rules as a ConfigMap
volumeMounts:
  - name: fork-config
    mountPath: /config

volumes:
  - name: fork-config
    configMap:
      name: gateway-fork-config
```

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: gateway-fork-config
data:
  # Rules file — mounted as additional application.properties
  application.properties: |
    fork.enabled=true
    fork.rules[0].id=asset-track-canary
    fork.rules[0].enabled=true
    fork.rules[0].paths[0]=/v1/asset/track
    fork.rules[0].body-parser=json
    fork.rules[0].key-field=asset_id
    fork.rules[0].filter-file=/config/asset-ids.txt
    fork.rules[0].targets[0].id=storm
    fork.rules[0].targets[0].mirror-host=https://storm.modulariot.com
    fork.rules[0].targets[0].mirror-path=/v1/asset/track
    fork.rules[0].targets[0].timeout=5000

  # Filter file — one routing key per line
  asset-ids.txt: |
    # Asset IDs to mirror to storm environment
    SVSX88
```

Add the Quarkus config location for the mounted file:

```yaml
env:
  - name: QUARKUS_CONFIG_LOCATIONS
    value: /config/application.properties
```

Configure APISIX to mirror traffic to the gateway:

```yaml
plugins:
  - name: proxy-mirror
    enable: true
    config:
      host: "http://prod-streamhub-gateway:8080"
      sample_ratio: 1
```

---

## Architecture

```
miot-gateway/
└── fork/                           Fork sub-module
    ├── config/
    │   └── ForkConfig.java         @ConfigMapping(prefix="fork")
    ├── model/
    │   ├── BodyParserType.java     JSON | CSV
    │   ├── ForkRule.java           Immutable runtime rule (built from config at startup)
    │   └── ForkTarget.java         Immutable runtime target (url pre-built at startup)
    ├── ForkFilterRegistry.java     In-memory routing key sets — lock-free reads, atomic reload
    ├── ForkEngine.java             Path index, key extraction, fan-out, pre-built metrics
    └── api/
        ├── ForkMirrorResource.java         POST /{path} — APISIX mirror receiver
        └── ForkManagementResource.java     /internal/fork/ — management API
```

### Request flow

1. APISIX mirrors `POST /v1/asset/track` to the gateway
2. `ForkMirrorResource` receives it and reconstructs the full path
3. `ForkEngine.findRulesForPath()` looks up matching rules from the path index (O(1) HashMap lookup)
4. For each matching rule:
   - Extract routing key from body using the rule's body parser
   - Check the key against `ForkFilterRegistry` (lock-free `ConcurrentHashMap` read)
   - If present: fan out to all targets via `HttpClient.sendAsync()` (fire-and-forget)
   - If absent: increment discarded counter, return
5. Always respond `200 OK` — APISIX discards the mirror response

---

## Configuration Reference

### Component activation

| Property | Env var | Default | Description |
|---|---|---|---|
| `miot.component.gateway.enabled` | `MIOT_COMPONENT_GATEWAY_ENABLED` | `false` | Activates the gateway component (CDI beans, endpoint registration) |

### Fork engine

| Property | Env var | Default | Description |
|---|---|---|---|
| `fork.enabled` | `FORK_ENABLED` | `false` | Enables the fork engine. Gateway can be active with forking off. |

### Fork rules (`fork.rules[N]`)

Each rule is an entry in an indexed list. Multiple rules can be defined with independent paths, parsers, filters, and targets.

| Property | Env var | Default | Description |
|---|---|---|---|
| `fork.rules[N].id` | `FORK_RULES_N__ID` | — | Unique rule identifier. Used in metrics labels and the management API. |
| `fork.rules[N].enabled` | `FORK_RULES_N__ENABLED` | `true` | Set to `false` to disable a rule without removing it from config. |
| `fork.rules[N].paths[M]` | `FORK_RULES_N__PATHS_M_` | — | Incoming path(s) this rule applies to. Multiple paths share the same parser and targets. |
| `fork.rules[N].body-parser` | `FORK_RULES_N__BODY_PARSER` | `json` | How to parse the request body. Options: `json`, `csv`. |
| `fork.rules[N].key-field` | `FORK_RULES_N__KEY_FIELD` | `asset_id` | Field name (JSON) or column name/index (CSV) to extract as the routing key. |
| `fork.rules[N].filter-file` | `FORK_RULES_N__FILTER_FILE` | — | Path to a plain-text filter file. Loaded at startup and on `/reload`. Intended for ConfigMap volume mounts. |

### Fork targets (`fork.rules[N].targets[M]`)

Each rule can have one or more targets. All matching targets receive the request in parallel.

| Property | Env var | Default | Description |
|---|---|---|---|
| `fork.rules[N].targets[M].id` | `FORK_RULES_N__TARGETS_M__ID` | — | Unique target identifier within the rule. Used in metrics labels. |
| `fork.rules[N].targets[M].mirror-host` | `FORK_RULES_N__TARGETS_M__MIRROR_HOST` | — | Target base URL — scheme + host + port, no trailing slash. |
| `fork.rules[N].targets[M].mirror-path` | `FORK_RULES_N__TARGETS_M__MIRROR_PATH` | `/` | Path on the target host. Concatenated with `mirror-host` to form the full URL. |
| `fork.rules[N].targets[M].timeout` | `FORK_RULES_N__TARGETS_M__TIMEOUT` | `5000` | HTTP timeout in milliseconds for forwarded requests. |

> **Env var naming convention** — MicroProfile Config maps indexed list segments using underscores: `[N]` → `_N_` and property separators `.` → `_`. Double underscores appear where both a separator and an index meet.

### Full example (application.properties)

```properties
miot.component.gateway.enabled=true
fork.enabled=true

# Rule 0 — asset-id based canary fork, JSON body, single storm target
fork.rules[0].id=asset-track-canary
fork.rules[0].enabled=true
fork.rules[0].paths[0]=/v1/asset/track
fork.rules[0].paths[1]=/api/v1/asset/track
fork.rules[0].body-parser=json
fork.rules[0].key-field=asset_id
fork.rules[0].filter-file=/config/asset-ids.txt
fork.rules[0].targets[0].id=storm
fork.rules[0].targets[0].mirror-host=https://storm.modulariot.com
fork.rules[0].targets[0].mirror-path=/v1/asset/track
fork.rules[0].targets[0].timeout=5000

# Rule 1 — same paths, second target for a backup environment
fork.rules[1].id=asset-track-backup
fork.rules[1].enabled=false
fork.rules[1].paths[0]=/v1/asset/track
fork.rules[1].body-parser=json
fork.rules[1].key-field=asset_id
fork.rules[1].filter-file=/config/asset-ids-backup.txt
fork.rules[1].targets[0].id=backup
fork.rules[1].targets[0].mirror-host=https://backup.modulariot.com
fork.rules[1].targets[0].mirror-path=/v1/asset/track
```

---

## Filter File Format

Plain text, one routing key per line. Lines starting with `#` and blank lines are ignored.

```
# Asset IDs to forward to storm
# Updated: 2026-04-06
SVSX88
ABC123
DEF456
```

The file is loaded once at startup. Use the management API to reload after updating the ConfigMap.

---

## Management API

All endpoints are under `/internal/fork/` and are only reachable within the cluster (ClusterIP service, no external route).

### List rules

```http
GET /internal/fork/rules
```

Returns all active rules with their current filter size and resolved target URLs.

```json
[
  {
    "id": "asset-track-canary",
    "paths": ["/v1/asset/track"],
    "bodyParser": "JSON",
    "keyField": "asset_id",
    "filterFile": "/config/asset-ids.txt",
    "filterSize": 2,
    "targets": [
      { "id": "storm", "url": "https://storm.modulariot.com/v1/asset/track", "timeout": 5000 }
    ]
  }
]
```

### Inspect filter

```http
GET /internal/fork/rules/{id}/filter
```

```json
["SVSX88", "ABC123"]
```

### Add keys

```http
POST /internal/fork/rules/{id}/filter
Content-Type: application/json

["DEF456", "GHI789"]
```

```json
{ "added": 2, "total": 4 }
```

### Remove a key

```http
DELETE /internal/fork/rules/{id}/filter/{key}
```

```json
{ "removed": true, "total": 3 }
```

### Reload from file

Re-reads the configured filter file and atomically replaces the in-memory set. Use this after updating a ConfigMap without restarting the pod.

```http
POST /internal/fork/rules/{id}/filter/reload
```

```json
{ "loaded": 2, "total": 2 }
```

Returns `409 Conflict` if the rule has no filter file configured.

---

## Metrics

Exposed at `GET /q/metrics` (Prometheus format).

| Metric | Type | Labels | Description |
|---|---|---|---|
| `fork_requests_total` | Counter | `rule`, `target`, `outcome={forwarded,discarded,error}` | Request count per rule, target, and outcome |
| `fork_forward_duration_seconds` | Timer | `rule`, `target` | Latency of forwarded HTTP calls (P50, P95, P99, MAX) |
| `fork_filter_size` | Gauge | `rule` | Number of routing keys currently in the in-memory filter |

Example Prometheus output:

```
fork_requests_total{rule="asset-track-canary",target="storm",outcome="forwarded"} 1234.0
fork_requests_total{rule="asset-track-canary",target="-",outcome="discarded"} 56789.0
fork_requests_total{rule="asset-track-canary",target="storm",outcome="error"} 3.0
fork_forward_duration_seconds_count{rule="asset-track-canary",target="storm"} 1234.0
fork_forward_duration_seconds_sum{rule="asset-track-canary",target="storm"} 52.341
fork_filter_size{rule="asset-track-canary"} 2.0
```

---

## Body Parsers

### JSON

Extracts a top-level field value by name.

```json
{ "asset_id": "SVSX88", "lat": -33.4489, "lng": -70.6693 }
```

```properties
fork.rules[0].body-parser=json
fork.rules[0].key-field=asset_id
```

### CSV

Extracts a field by column name (first row treated as header) or by zero-based column index.

```csv
asset_id,lat,lng,timestamp
SVSX88,-33.4489,-70.6693,2026-04-06T10:00:00Z
```

```properties
fork.rules[0].body-parser=csv
fork.rules[0].key-field=asset_id    # by column name
# or:
fork.rules[0].key-field=0           # by column index
```

---

## Health

```
GET /q/health/ready   → 200 (gateway component up)
GET /q/health/live    → 200
```

The gateway has no database dependency and starts healthy immediately.
