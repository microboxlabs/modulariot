# Elementos y objetos — las 17 tablas

Todas llevan `tenant_code`, auditoría (`created_at/by`, `updated_at/by`) y —salvo las marcadas—
versionado SCD2 (`version_of`, `is_active`, `version_from/to`).

## miot_fleet (migración `V0.9.9`, PR 2)

| Tabla | Qué es | Claves |
|---|---|---|
| `carrier` | Transportista: rut, razón social, licencia de transporte (+vencimiento), contacto, `is_occasional` | vigente único por `(tenant, rut)` |
| `truck` | Camión/tracto: patente, vin, tipo, capacidades; pertenece a un carrier | vigente único por `(tenant, license_plate)` |
| `trailer` | Remolque/rampla: patente, tipo, capacidad; pertenece a un carrier | vigente único por `(tenant, license_plate)` |
| `driver` | Conductor: rut, nombre, teléfonos, licencia (+vencimiento); carrier opcional | vigente único por `(tenant, rut)` |
| `resource_attribute` | Atributo con vigencia de cualquier recurso: acreditación de faena, certificación, seguro, licencia. Heredero de `ams.rd_resource_attributes` | upsert por `(tenant, resource_type, resource_id, attribute_type, attribute_key)` |

Sin DELETE físico: desactivación por `status` / borrado lógico. `source_system`/`source_data`
conservan el crudo de la fuente (el sistema de origen de cada integración).

## miot_trips (migración `V0.10.0`, PR 3)

| Tabla | Qué es | Reglas clave |
|---|---|---|
| `location` | Ubicación nombrada (planta, puerto, cd, cliente, zona), geometría GeoJSON opcional | catálogo por tenant |
| `mandate` | El encargo del cliente: `external_code` único por tenant, tipo, referencia, origen/destino, SLA, estado (`activo→en_ejecucion→cerrado`/`anulado`) | create-or-return por código; no cierra con viajes vivos (409) |
| `mandate_line` | Línea del mandato (seq); la primera se crea junto con el mandato | `UNIQUE (mandate_id, seq)` |
| `cargo_unit` | Unidad de carga de una línea, con parciales autonumerados, cantidades y ciclo `anunciada→lista→retirada→entregada→recibida/rechazada`; recepción `conforme`/`diferencia` (diferencia exige detalle) | estados de ejecución los mueve el viaje, no el PATCH |
| `trip` | La ejecución: `planificado→en_ruta→realizado`/`anulado`, fechas plan/real | el estado lo mueven las etapas, nunca un PATCH de status |
| `trip_mandate` | Vínculo N:M viaje↔mandato con rol y orden | re-vincular = 200 (idempotente); no desvincula con carga a bordo (409) |
| `stage` | Etapa = estado: catálogo cerrado de 6 tipos, `seq`, una `en_curso` a la vez, fechas plan/real, checklist JSONB, **`service_status`** (estado de negocio que proyecta al tablero) | `start`/`close`; solo etapas pendientes se re-planifican |
| `stage_activity` | Actividad dentro de una etapa (tipo libre, asignatario, evidencia JSONB) | `UNIQUE (stage_id, seq)` |
| `trip_resource_assignment` | Asignación de recurso de `miot_fleet` al viaje con **vigencia operativa** (`valid_from/to`): cambio de camión = cerrar una ventana y abrir otra; nada se pisa | el service valida que el recurso exista en `miot_fleet`; `double_driver` se deriva de 2 ventanas driver abiertas |
| `trip_cargo` | Qué carga va en qué viaje, con la etapa donde se montó/desmontó | no desmonta una vez retirada (409) |
| `trip_live` † | **Proyección** del tablero caliente — compatible con el contrato `live_trip` actual (asset, conductor(es), carrier, rampla, geocercas, ETA). La escribe solo `TripLiveProjector` (y el motor sus campos) | nace con el viaje, muere en `realizado`/`anulado`; sin API de escritura |
| `audit_event` † | Bitácora: actor, acción, entidad, detalle JSONB, keyset por tenant | best-effort, nunca bloquea la operación |

† sin versionado SCD2: `trip_live` es proyección efímera y `audit_event` es append-only.

## Decisiones de alineación (A1–A8)

| # | Decisión | Resolución |
|---|---|---|
| A1 | Nombre del módulo | `miot-trips`, paquete `com.microboxlabs.miot.trips`, módulo IAM `trips` |
| A2 | Ruta base | `/api/v1/orgs/{organizationId}/trips/...` (recursos de flota: `.../fleet/...`) |
| A3 | Tenencia | `tenant_code` + FKs compuestas `(id, tenant_code)` — el patrón de miot-symptoms |
| A4 | Migraciones | fleet `V0.9.9` (siguiente libre en trunk) y trips `V0.10.0`; locations por componente en `FlywayMigrator` |
| A5 | Flag de build | `miot.component.trips.enabled` (fleet ya tiene el suyo) |
| A6 | trip_live | Sin API de escritura; solo lectura para el tablero |
| A7 | Feeds | Entran por estas mismas APIs con service accounts (API key `miot_sk_…`) |
| A8 | Coordinación | Este stack de PRs es la revisión: nada se mergea sin el OK del socio |
