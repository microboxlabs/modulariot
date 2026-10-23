# Superficie API y catálogo de invocaciones

Convenciones (calcadas de miot-symptoms): `@PermissionsAllowed` por endpoint con `OrgPermission`,
PATCH con semántica `null` = conserva / `""` = limpia, 201 al crear / 204 en acciones, acciones de
dominio como `POST /{id}/verbo` (nunca PATCH de status), errores 400 dato inválido · 404 no existe
· 409 conflicto de estado, SQLSTATE traducido centralmente (23505→409, 23503/23514→400).

## Autenticación

- **Usuarios**: JWT RS256 (JWKS Auth0), org por slug del path → tenant.
- **Feeds / integraciones**: service account con API key (`Authorization: Bearer miot_sk_…`),
  una por pipeline, permisos mínimos del feed. Sin flujo de obtención de token: la key se emite
  al crear la service account y el modulith la resuelve a tenant + permisos.

## miot-fleet — recursos y acreditación (PR 2)

Base `/api/v1/orgs/{org}/fleet` · permisos `fleet:resources.view|write`, `fleet:accreditation.write`

| Recurso | Endpoints |
|---|---|
| `/resources/carriers` · `/trucks` · `/trailers` · `/drivers` | `GET` (filtros `q`, `plate`, `rut`) · `POST` · `PATCH /{id}` — 12 endpoints, sin DELETE (status) |
| `/accreditation` | `POST` (upsert por clave natural) · `GET /{resourceType}/{resourceId}` · `GET /accredited?attributeKey=` (equivalente API de `fn_rd_accredited_resources`) |

## miot-trips — 51 endpoints en 12 resources (PR 4)

Base `/api/v1/orgs/{org}/trips` · 7 permisos `trips:*` · roles `TRIPS_VIEWER` /
`TRIPS_OPERATOR` (legacy default) / `TRIPS_MAINTAINER`

| Resource | Endpoints |
|---|---|
| Access | `GET /access` — qué puede el caller |
| Mandates | `GET` lista · `POST` (crea-o-devuelve por `externalCode`) · `GET/PATCH /{id}` · `POST /{id}/close` · `POST /{id}/cancel` |
| Cargo | `GET/POST /mandates/{id}/cargo` · `PATCH /cargo/{id}` · `POST /cargo/{id}/receive` |
| Trips | `GET` lista · `POST` (con plan de etapas y `serviceStatus`) · `GET/PATCH /{id}` · `POST /{id}/mandates` · `DELETE /{id}/mandates/{mid}` · `POST /{id}/cancel` |
| Stages | `GET/POST /trips/{id}/stages` · `PATCH /stages/{id}` (solo pendientes) · `POST /stages/{id}/start` · `POST /stages/{id}/close` |
| Activities | `GET/POST /stages/{id}/activities` · `PATCH /activities/{id}` · `POST /activities/{id}/complete` |
| Assignments | `GET/POST /trips/{id}/assignments` · `POST /assignments/{id}/end` (vigencias: cambio de recurso = end + alta) |
| TripCargo | `POST /trips/{id}/cargo` (montar) · `PATCH` (etapa de carga/descarga) · `DELETE` (desmontar) |
| Live | `GET /live` · `GET /live/{tripId}` — solo lectura (tablero) |
| Locations | `GET` · `POST` · `PATCH /{id}` |
| Audit | `GET /audit` — keyset por tenant |

## Catálogo estándar: cambio en la fuente → invocación

Producto, no pipeline: vale para cualquier integración. El pipeline del cliente solo **detecta**
el cambio en su fuente; el producto lo interpreta, protege y registra siempre igual.

| Cambio en el registro | Invocación estándar | Garantía del producto |
|---|---|---|
| Aparece un servicio | `POST /mandates` + `POST /trips` (plan de etapas) + asignaciones | idempotente por código; nace la fila caliente |
| Tick sin cambios | — | reintentos y re-lecturas no ensucian nada |
| Cambia un recurso | `POST /assignments/{id}/end` + `POST /trips/{id}/assignments` | vigencias: nada se pisa, historia consultable |
| Doble conducción on/off | alta / end de la 2ª ventana driver | `double_driver` se deriva solo |
| Cambia la salida programada | `PATCH /trips/{id}` | versión anterior archivada |
| Cambia la ETA | `PATCH /stages/{final pendiente}` | solo pendientes (409 si no); ETA recalcula |
| Cambian datos del encargo | `PATCH /mandates/{id}` | null conserva, "" limpia |
| Avanza el proceso | `POST /stages/{id}/start` / `/close` | nunca PATCH de status; una en curso (409) |
| El servicio termina | close de `cierre` + `POST /mandates/{id}/close` | viaje realizado; fila caliente muere |
| Se anula | `POST /trips/{id}/cancel` {reason} | motivo a la historia; fila caliente muere |
| La fila desaparece de la fuente | — nada | la ausencia no anula (herencia del upsert) |
| Re-datos de carga | `PATCH /cargo/{id}` | estados de ejecución los mueve solo el viaje |

En todo cambio, sin que el pipeline haga nada: versionado SCD2, auditoría con actor,
protecciones 400/404/409 e idempotencia (crea-o-devuelve, re-vincular = 200).
