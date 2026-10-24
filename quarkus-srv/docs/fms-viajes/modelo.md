# El modelo a implementar

## Principios

1. **Encargo ≠ ejecución.** El `mandate` es lo que el cliente pide (código externo, origen/destino,
   SLA). El `trip` es cómo se ejecuta. N mandatos pueden viajar en un viaje (`trip_mandate`) y un
   mandato puede necesitar varios viajes.
2. **Las etapas SON los estados.** El avance de un viaje no es un campo `status` que se PATCHea:
   es abrir y cerrar etapas (`stage`) de un catálogo cerrado (`preparacion`, `carga`, `transito`,
   `parada`, `descarga`, `cierre`). Una sola etapa en curso a la vez (índice parcial). Abrir la
   primera pone el viaje `en_ruta`; cerrar la etapa `cierre` lo realiza.
3. **`service_status`: la etapa proyecta el estado de negocio.** Cada etapa puede declarar qué
   estado —en el vocabulario del tenant— proyecta al tablero mientras corre (un tenant:
   `ADDED`/`SCHEDULED`/`ONGOING`/`ARRIVED`/`FINISHED`; otro: `en ruta`/`cerrado`). Es dato, no
   comportamiento: el motor no conoce vocabularios.
4. **`trip_live` es proyección, no registro.** La fila caliente del tablero la mantienen triggers
   del registro (nace con el viaje, muere al realizarlo/anularlo). No tiene API de escritura.
5. **Recursos en su propio módulo.** Flota (transportista, camión, remolque, conductor) y
   acreditación viven en `miot_fleet`, con ciclo de vida propio e independiente de los viajes.
   `miot_trips` los referencia por id; `AssignmentService` valida la referencia con el servicio de fleet.
6. **Versionado SCD2 en la misma tabla.** Nada se pisa: cada UPDATE archiva la versión anterior
   (trigger genérico). La fila vigente conserva su `id` (las FKs no se tocan) y es la única con
   `version_of IS NULL AND is_active`. El borrado es lógico (`is_active = false`). La explotación
   histórica se hace sobre la misma tabla con las ventanas `version_from`/`version_to`.
7. **Multi-tenant por `tenant_code`** en cada tabla y cada WHERE, con FKs compuestas
   `(id, tenant_code)` — mismo patrón que miot-symptoms.
8. **Auditoría en todo**: `audit_event` registra actor y acción de cada operación de dominio.

## DER — miot_fleet (PR 2)

```mermaid
erDiagram
    carrier ||--o{ truck : "carrier_id"
    carrier ||--o{ trailer : "carrier_id"
    carrier |o--o{ driver : "carrier_id (opcional)"
    carrier ||--o{ resource_attribute : "resource_type='carrier'"
    truck ||--o{ resource_attribute : "resource_type='truck'"
    trailer ||--o{ resource_attribute : "resource_type='trailer'"
    driver ||--o{ resource_attribute : "resource_type='driver'"

    carrier {
        uuid id PK
        varchar tenant_code
        varchar rut
        varchar legal_name
        varchar transport_license
        varchar status
        boolean is_occasional
        jsonb source_data
    }
    truck {
        uuid id PK
        uuid carrier_id FK
        varchar license_plate
        varchar truck_type
        numeric max_weight
        varchar status
    }
    trailer {
        uuid id PK
        uuid carrier_id FK
        varchar license_plate
        varchar trailer_type
        varchar status
    }
    driver {
        uuid id PK
        uuid carrier_id FK
        varchar rut
        varchar full_name
        varchar license_category
        varchar status
    }
    resource_attribute {
        uuid id PK
        varchar resource_type
        uuid resource_id
        varchar attribute_type "SITE_ACCREDITATION, CERTIFICATION, INSURANCE, LICENSE"
        varchar attribute_key "MEL, ADR, RC, ITV"
        varchar attribute_value "ACCREDITED, VALID, REVOKED, EXPIRED"
        timestamptz valid_from
        timestamptz valid_until
    }
```

`resource_attribute` es el heredero directo de `ams.rd_resource_attributes`: acreditaciones de
faena, certificaciones, seguros y licencias como atributos con vigencia, upsert por clave natural
`(tenant, resource_type, resource_id, attribute_type, attribute_key)` sobre la versión vigente.

## DER — miot_trips (PR 3)

```mermaid
erDiagram
    mandate ||--o{ mandate_line : "línea automática"
    mandate_line ||--o{ cargo_unit : "parciales"
    mandate }o--o| location : "origen/destino"
    trip }o--o| location : "origen/destino"
    trip ||--o{ trip_mandate : ""
    mandate ||--o{ trip_mandate : ""
    trip ||--o{ stage : "subject"
    stage ||--o{ stage_activity : ""
    stage }o--o| location : ""
    trip ||--o{ trip_resource_assignment : "vigencias"
    trip ||--o{ trip_cargo : ""
    cargo_unit ||--o{ trip_cargo : ""
    trip ||--o| trip_live : "proyección (triggers)"

    mandate {
        uuid id PK
        varchar tenant_code
        varchar external_code "UNIQUE por tenant"
        varchar order_type
        varchar status "activo, en_ejecucion, cerrado, anulado"
        int sla_minutes
    }
    trip {
        uuid id PK
        varchar status "planificado, en_ruta, realizado, anulado"
        timestamptz planned_start
        timestamptz actual_start
        timestamptz actual_end
    }
    stage {
        uuid id PK
        varchar stage_type "preparacion, carga, transito, parada, descarga, cierre"
        varchar status "pendiente, en_curso, cerrada"
        varchar service_status "vocabulario del tenant"
        int seq
        timestamptz planned_end
    }
    cargo_unit {
        uuid id PK
        int partial_no
        varchar status "anunciada, lista, retirada, entregada, recibida, rechazada"
        varchar receipt_result "conforme, diferencia"
    }
    trip_resource_assignment {
        uuid id PK
        varchar resource_type "truck, trailer, driver -> miot_fleet"
        uuid resource_id "validado por el servicio de fleet"
        timestamptz valid_from
        timestamptz valid_to
    }
    trip_live {
        uuid trip_id PK
        varchar status "proyectado por service_status"
        varchar asset_id
        varchar driver_name
        boolean double_driver
        timestamptz estimated_arrival_time
    }
```

## Versionado SCD2 — cómo funciona

Columnas en cada tabla de registro: `version_of UUID` (NULL = vigente), `is_active BOOLEAN`,
`version_from`, `version_to`. Trigger genérico `fn_version_on_update()` (schema-agnóstico,
`TG_TABLE_SCHEMA`): en cada UPDATE inserta la imagen anterior como fila archivada
(`version_of = id vigente`, ventana cerrada) y la vigente sigue con su `id`.

- Los índices de unicidad de negocio son **parciales**: `WHERE version_of IS NULL AND is_active`.
- Distinción deliberada: `version_from/to` (ventana de la **versión**) ≠
  `valid_from/to` de `trip_resource_assignment` (vigencia **operativa** de la asignación).
- Consulta histórica: misma tabla, `WHERE version_of = :id OR id = :id ORDER BY version_from`.

## Triggers de integridad (además del versionado)

| Trigger | Regla |
|---|---|
| una etapa en curso | índice parcial único sobre `(subject_type, subject_id) WHERE status='en_curso' AND version_of IS NULL AND is_active` |
| proyección `trip_live` | nace con el viaje, refresca con etapas/asignaciones (`COALESCE(service_status, status)`), muere al realizar/anular |

## Reglas en los services

| Dónde | Regla |
|---|---|
| `AssignmentService` | el recurso asignado existe en `miot_fleet` para el tenant y no está `inactive` (400) |
| `MandateStore.insertOrGet` | crear mandato ⇒ crea su `mandate_line` seq 1 |
| `TripCargoService.mount` | montar una carga vincula al viaje el mandato dueño de la carga |
| `MandateService.requireOpen` | un mandato cerrado o anulado no toma viajes nuevos, directo ni por carga montada (409) |
