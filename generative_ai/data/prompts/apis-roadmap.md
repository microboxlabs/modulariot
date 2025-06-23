Below is a **“v 1” REST+SSE contract** that covers every external surface Modular IoT (MIOT) will expose after the milestones you approved.
It’s grouped by functional area so you can split implementation between the **Next.js BFF** (Auth/UI-facing CRUD) and the **Quarkus services** (high-throughput ingest, symptom engine).
Use it as the *stable baseline*; future changes should be additive, never breaking existing shapes.

---

## 0. Conventions

* **Base URL:** `https://api.modulariot.app/v1`
* **Auth:** Bearer **JWT** in `Authorization: Bearer <token>`
  – *User* tokens (issued by Auth service)
  – *API* tokens (scoped to `ingest`, `read`, `admin`).
* **Errors:** JSON ⇒ `{ "error": "INVALID_TOKEN", "message": "token expired" }`
* **Pagination:** `?page=1&per=50` → `X-Total-Count`, `Link: <..>; rel="next"`.
* **Id format:** ULID strings (`01FZXG8...`) unique across tables.
* **Time:** ISO-8601 UTC (`2025-06-22T16:04:15Z`).

---

## 1. Auth & Identity  (BFF Node)

| Method | Path                  | Purpose                                                 |
| ------ | --------------------- | ------------------------------------------------------- |
| `POST` | `/auth/signup`        | `{ email, password }` ➜ email-verify link               |
| `POST` | `/auth/login`         | `{ email, password }` → `{ accessToken, refreshToken }` |
| `POST` | `/auth/oauth/google`  | OIDC redirect flow                                      |
| `POST` | `/auth/refresh`       | swap refresh-token for new pair                         |
| `POST` | `/auth/logout`        | revoke current tokens                                   |
| `GET`  | `/user/me`            | signed-in profile + currentOrgId                        |
| `GET`  | `/user/organizations` | org list + role per org                                 |

---

## 2. Organizations & Membership  (BFF Node)

| Method   | Path                                | Scope    | Notes             |
| -------- | ----------------------------------- | -------- | ----------------- |
| `POST`   | `/organizations`                    | user     | `{ name }`        |
| `GET`    | `/organizations/:orgId`             | org read | full org object   |
| `PATCH`  | `/organizations/:orgId`             | owner    | rename            |
| `DELETE` | `/organizations/:orgId`             | owner    | soft-delete       |
| `GET`    | `/organizations/:orgId/members`     | admin    | list w/ roles     |
| `POST`   | `/organizations/:orgId/invitations` | admin    | `{ email, role }` |
| `POST`   | `/invitations/:token/accept`        | user     | joins org         |

---

## 3. API Tokens  (BFF Node)

| Method   | Path                           | Role  | Payload                                          |
| -------- | ------------------------------ | ----- | ------------------------------------------------ |
| `GET`    | `/organizations/:orgId/tokens` | admin | list tokens                                      |
| `POST`   | `/organizations/:orgId/tokens` | admin | `{ label, scopes:[ingest] }` returns secret once |
| `PATCH`  | `/tokens/:tokenId`             | admin | rotate / disable                                 |
| `DELETE` | `/tokens/:tokenId`             | admin | revoke                                           |

---

## 4. Device-Type Catalog  (BFF Node, read-only)

| Method | Path                    | Notes                            |
| ------ | ----------------------- | -------------------------------- |
| `GET`  | `/device-types`         | all built-ins                    |
| `GET`  | `/device-types/:typeId` | schema JSON + supported symptoms |

---

## 5. Devices  (BFF Node)

| Method   | Path                                 | Notes                                 |
| -------- | ------------------------------------ | ------------------------------------- |
| `GET`    | `/organizations/:orgId/devices`      | list (filter `status=`)               |
| `POST`   | `/organizations/:orgId/devices`      | register one `{ hwId, typeId, name }` |
| `POST`   | `/organizations/:orgId/devices/bulk` | CSV upload                            |
| `GET`    | `/devices/:deviceId`                 | detail                                |
| `PATCH`  | `/devices/:deviceId`                 | rename / metadata                     |
| `DELETE` | `/devices/:deviceId`                 | remove                                |

---

## 6. Symptom Configuration  (BFF Node → Quarkus)

| Method  | Path                                      | Notes                        |
| ------- | ----------------------------------------- | ---------------------------- |
| `GET`   | `/devices/:deviceId/symptoms`             | current toggles + thresholds |
| `PATCH` | `/devices/:deviceId/symptoms/:symptomKey` | `{ enabled, threshold }`     |
| `GET`   | `/organizations/:orgId/symptom-configs`   | defaults per device-type     |

---

## 7. Symptom Events Feed  (Quarkus)

| Endpoint                                   | Transport | Notes                              |               |
| ------------------------------------------ | --------- | ---------------------------------- | ------------- |
| `GET /organizations/:orgId/symptom-events` | **SSE**   | `?since=` ULID, server push stream |               |
| `GET /organizations/:orgId/symptom-events` | REST      | paged list                         |               |
| `PATCH /symptom-events/:eventId`           | REST      | \`{ action:"ack"                   | "silence" }\` |

*Event object*

```json
{
  "id": "01HX1H...",
  "deviceId": "01HX1E...",
  "symptom": "SIGNAL_LOST",
  "severity": "CRITICAL",
  "firstSeen": "2025-06-22T16:00:03Z",
  "lastSeen": "2025-06-22T16:01:03Z",
  "state": "ACTIVE"   // or ACKED | SILENCED | RESOLVED
}
```

---

## 8. Usage & Billing  (BFF Node)

| Method | Path                                     | Notes                                  |
| ------ | ---------------------------------------- | -------------------------------------- |
| `GET`  | `/organizations/:orgId/usage`            | rolled-up counters (devices, messages) |
| `GET`  | `/organizations/:orgId/billing/estimate` | projected cost this month              |
| `GET`  | `/organizations/:orgId/invoices`         | Stripe webhook mirror                  |
| `GET`  | `/invoices/:invoiceId`                   | PDF link + line-items                  |

---

## 9. Webhooks / Notifications  (BFF Node)

| Method   | Path                             | Notes                                          |
| -------- | -------------------------------- | ---------------------------------------------- |
| `GET`    | `/organizations/:orgId/webhooks` | list endpoints                                 |
| `POST`   | `/organizations/:orgId/webhooks` | `{ url, events:["symptom.critical"], secret }` |
| `PATCH`  | `/webhooks/:webhookId`           | enable/disable                                 |
| `DELETE` | `/webhooks/:webhookId`           | remove                                         |

> **Delivery schema** (HMAC-SHA256 sign in `X-MIOT-Signature`):

```json
{
  "event": "symptom.critical",
  "orgId": "01HX1...",
  "payload": { /* SymptomEvent object */ },
  "sentAt": "2025-06-22T16:02:00Z"
}
```

---

## 10. Device **Ingest** HTTP Endpoint  (Quarkus)

| Method | Path      | Auth                                   | Notes                        |
| ------ | --------- | -------------------------------------- | ---------------------------- |
| `POST` | `/ingest` | Bearer **API token** (scope =`ingest`) | Body = NDJSON, GZip accepted |

*Payload line (example GPS)*

```json
{
  "deviceId": "01HX1E...",
  "ts": 1719081723000,
  "type": "gps",
  "lat": -33.2031,
  "lon": -70.6695,
  "speedKph": 78.2
}
```

*For high-volume customers you’ll point devices to Pulsar MQTT or gRPC; HTTP is the universal fallback.*

---

## 11. Admin / Ops  (internal only)

| Method | Path             | Auth            | Notes                 |
| ------ | ---------------- | --------------- | --------------------- |
| `GET`  | `/admin/health`  | internal key    | composite healthcheck |
| `GET`  | `/admin/metrics` | Prometheus text |                       |

---

### Versioning strategy

* **Minor additions** (new fields, new endpoints) → stay in `v1`.
* **Breaking changes** (remove/rename) → bump to `/v2`.
* Deprecate with `Sunset` header + `Deprecation: true` six months in advance.

---

### Next step

* Decide which portions live in **Next.js BFF** (everything up to ingest) vs **Quarkus** (ingest + symptom feed).
* Generate `openapi.yaml` from this table ⇒ feed into code-gen for TS & Java clients.
* Lock down the ingest JSON schemas early so device SDK authors can start implementation.

Let me know if you’d like me to draft the OpenAPI skeleton or expand any endpoint with full request/response examples!
