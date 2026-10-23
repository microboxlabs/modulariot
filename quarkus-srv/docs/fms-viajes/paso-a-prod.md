# Paso a producción

Principio: **dual-write primero, corte después, rollback siempre posible.** El flujo legado de
cada integración queda intacto hasta que miot gobierne; la rama nueva tiene su propio manejo de
error (un fallo de la API avisa, no rompe la escritura actual).

## Fases

### Fase 0 — Despliegue del modulith (este stack)
1. Merge del stack: docs → fleet (`V0.9.9`) → trips core (`V0.10.0`) → trips API.
2. Deploy con `miot.component.fleet.enabled` y `miot.component.trips.enabled`; Flyway aplica las
   dos migraciones (schemas nuevos: cero riesgo sobre lo existente).
3. Crear orgs/tenants que falten (client_id de Exacta) y **service accounts** con API key por
   feed: directorio (`fleet:resources.write` + `fleet:accreditation.write`) y servicios
   (`trips:*` de operación).

**Rollback fase 0**: apagar los flags. Los schemas quedan creados pero nada los consume.

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
7. Activar dual-write en los 3 pipelines de servicios de Mintral (create / modify / close) y el
   recableo de Exacta (workflow v2 ya probado en n8n en modo seco; el original queda inactivo de
   respaldo). Las invocaciones son las del catálogo estándar (`api.md`).
8. Periodo de sombra: `live_trip` (legado) y `trip_live` (miot) conviven; comparar diariamente
   fila a fila (mismo contrato de columnas). Criterio de GO: N días sin divergencias no explicadas.

**Rollback fase 2**: igual que fase 1 — apagar la rama/workflow nuevo; el legado nunca paró.

### Fase 3 — Corte
9. Los consumidores (tablero, reportes) leen de miot (`/trips/live`).
10. Se apagan las ramas legadas de los 9 pipelines; el workflow viejo de Exacta se archiva.
11. Se congela `ams` (solo lectura) y, pasado el periodo de gracia, se da de baja.

## Idempotencia y reintentos (por qué el dual-write es seguro)

- Crear = crea-o-devuelve; re-vincular = 200; reintentos del flujo legado no duplican nada.
- 409 = leer estado actual (`GET`) y continuar; el ejecutor común corta las invocaciones de un
  servicio al primer error sin afectar a los demás.
- La ausencia de una fila en la fuente no anula nada: solo acciones explícitas cambian estado.

## Qué observar en cada fase

| Señal | Dónde |
|---|---|
| Errores de la rama nueva | Slack del pipeline (endpoint + status + body) |
| Divergencia ams ↔ fleet | conteos por tabla + spot-check por recurso |
| Divergencia live_trip ↔ trip_live | comparación diaria fila a fila en sombra |
| Auditoría | `GET /trips/audit` por tenant |
| Historia de un cambio dudoso | versiones SCD2 de la fila (misma tabla) |

## Pendientes conocidos al momento del stack

- Definir el `client_id` definitivo de Exacta (hoy org de laboratorio).
- Las ramas dual-write de Mintral están generadas y documentadas pero aún no corridas dentro de
  n8n (el recableo de Exacta sí). Probarlas con un item de muestra antes de activar.
- La migración de datos `ams.rd_*` (fase 1, paso 4) se escribe y ensaya en dev antes del GO.
