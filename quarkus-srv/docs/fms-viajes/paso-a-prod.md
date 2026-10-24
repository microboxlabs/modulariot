# Paso a producción

Principio: **dual-write primero, corte después, rollback siempre posible.** El flujo legado de
cada integración queda intacto hasta que miot gobierne; la rama nueva tiene su propio manejo de
error (un fallo de la API avisa, no rompe la escritura actual).

## Fases

### Fase 0 — Despliegue del modulith (este stack)
1. Merge del stack: docs → fleet (`V0.9.9`) → trips core (`V0.10.0`) → trips API.
2. Deploy con `miot.component.fleet.enabled` y `miot.component.trips.enabled`; Flyway aplica las
   dos migraciones (schemas nuevos: cero riesgo sobre lo existente). Trips agrega también la
   location de fleet, porque lee los recursos de `miot_fleet`.
3. Crear orgs/tenants que falten y **service accounts** con API key por feed: directorio
   (`fleet:resources.write` + `fleet:accreditation.write`) y servicios (`trips:*` de operación).

**Rollback fase 0**: volver a desplegar la imagen anterior con su configuración de componentes.
Los flags son de build (`@IfBuildProperty`): cambiarlos en runtime no quita los beans, y
reconstruir con fleet apagado quitaría también los endpoints de flota que ya existían. Los
schemas nuevos quedan creados pero nada los consume.

### Fase 1 — Datos maestros (directorio + acreditación)
4. Migración inicial `ams.rd_*` → `miot_fleet.*` **conservando ids** (los pipelines y las
   asignaciones siguen funcionando con los mismos UUID); `rd_resource_attributes` →
   `resource_attribute` 1:1.
5. Activar dual-write en los 5 pipelines de directorio/acreditación (transportistas, camiones,
   remolques, conductores, acreditación): el flujo legado sigue escribiendo `ams`, la rama nueva
   invoca `/fleet/...`. Los vencimientos que hoy van en `source_data` se externalizan además como
   atributos.
6. Monitorear divergencias ams ↔ miot_fleet (conteo y spot-checks por recurso).

**Rollback fase 1**: desconectar la rama nueva del canvas; `ams` nunca dejó de escribirse.

### Fase 2 — Servicios (viajes)
7. Activar dual-write en los pipelines de servicios (create / modify / close) y en el workflow
   v2 de la integración por planilla. El workflow original sigue activo hasta el corte: v2 solo
   agrega las invocaciones a la API, y `live_trip` sigue recibiendo la escritura legada. Las
   invocaciones son las del catálogo estándar (`api.md`).
8. Periodo de sombra: `live_trip` (legado) y `trip_live` (miot) conviven; comparar diariamente
   fila a fila (mismo contrato de columnas). Criterio de GO: N días sin divergencias no explicadas.

**Rollback fase 2**: igual que fase 1 — apagar la rama/workflow nuevo; el legado nunca paró.

### Fase 3 — Corte
9. Migrar y validar los lectores SQL del legado antes de apagar escrituras. Hoy leen `live_trip`
   o `ams.rd_*`:

   | Lector | Lee |
   |---|---|
   | `miot-symptoms` `SignalStream`, `ReferenceCache` | `live_trip`, `ams.rd_drivers`, canal `signal-live-trip` |
   | `miot-symptoms` `EngineCaseService`, `SymptomParticipants`, `PgTreatmentReads` | `live_trip` |
   | `miot-fleet` `GpsFleetData`, `GpsSharingSource` | `public.live_trip` |

10. Los consumidores (tablero, reportes) leen de miot (`/trips/live`).
11. Se apagan las ramas legadas de los pipelines. El dual-write se mantiene durante una ventana de
    rollback acordada antes del corte; pasada esa ventana, el rollback al legado deja de estar
    soportado.
12. Se congela `ams` (solo lectura) y, pasado el periodo de gracia, se da de baja.

**Rollback fase 3**: dentro de la ventana, volver los lectores a `live_trip`/`ams`, que siguen al
día por el dual-write. Fuera de la ventana, los cambios hechos solo en miot se reproducen en el
legado desde `audit_event` y las versiones SCD2 antes de volver.

## Idempotencia y reintentos (por qué el dual-write es seguro)

- Crear = crea-o-devuelve; re-vincular = 200; reintentos del flujo legado no duplican nada.
- 409 = leer estado actual (`GET`) y continuar; el ejecutor común corta las invocaciones de un
  servicio al primer error sin afectar a los demás.
- La ausencia de una fila en la fuente no anula nada: solo acciones explícitas cambian estado.

## Qué observar en cada fase

| Señal | Dónde |
|---|---|
| Errores de la rama nueva | canal de alertas del pipeline (endpoint + status + body) |
| Divergencia ams ↔ fleet | conteos por tabla + spot-check por recurso |
| Divergencia live_trip ↔ trip_live | comparación diaria fila a fila en sombra |
| Auditoría | `GET /trips/audit` por tenant |
| Historia de un cambio dudoso | versiones SCD2 de la fila (misma tabla) |

## Pendientes conocidos al momento del stack

- Definir el `client_id` definitivo de la integración por planilla (hoy org de laboratorio).
- Las ramas dual-write de los pipelines de servicios están generadas pero aún no corridas en n8n
  (el workflow v2 de la planilla sí). Probarlas con un item de muestra antes de activar.
- La migración de datos `ams.rd_*` (fase 1, paso 4) se escribe y ensaya en dev antes del GO.
