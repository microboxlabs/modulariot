# FMS estándar de viajes — miot-fleet (recursos) + miot-trips

Soporte estándar de viajes/servicios para la plataforma: mandatos, viajes, etapas, carga,
asignación de recursos y tablero caliente, multi-tenant, con versionado completo y auditoría.
Reemplaza el par `live_trip`/upserts por cliente con **un solo modelo y una sola API** para
todos los tenants (Mintral, Exacta y los que vengan).

## Qué resuelve

- Hoy cada integración (ECM Mintral, Excel Exacta) escribe su propia fila caliente con SQL
  propio. No hay historia, no hay etapas, no hay carga, no hay reglas comunes.
- Este estándar separa **el encargo** (mandato del cliente) de **la ejecución** (viaje con
  etapas) y de **los recursos** (flota y acreditación, en su propio módulo), y deja el tablero
  caliente (`trip_live`) como una **proyección** que mantienen triggers — nadie la escribe por API.
- Los pipelines de integración ya no escriben Postgres: invocan la API con service accounts.

## Mapa de lectura (el stack de PRs)

| PR | Contenido | Documento guía |
|---|---|---|
| 1 (este) | Documentación: modelo, objetos, API, paso a prod | esta carpeta |
| 2 | `miot-fleet`: recursos (carrier/truck/trailer/driver) + acreditación — migración `V0.9.9` | [modelo.md](modelo.md) · [objetos.md](objetos.md) |
| 3 | `miot-trips` núcleo: migración `V0.10.0`, dominio, stores, servicios, versionado SCD2 + cableado del modulith | [modelo.md](modelo.md) · [objetos.md](objetos.md) |
| 4 | `miot-trips` API: 51 endpoints, catálogo IAM, tests | [api.md](api.md) |

## Documentos

- [modelo.md](modelo.md) — el modelo a implementar: principios, DER de ambos schemas, versionado, `service_status`
- [objetos.md](objetos.md) — elementos y objetos: las 17 tablas una a una, y las decisiones de alineación A1–A8
- [api.md](api.md) — superficie API, autenticación, y el catálogo estándar cambio→invocación
- [paso-a-prod.md](paso-a-prod.md) — dual-write, orden de corte, rollback y checklist

## Estado de pruebas (2026-10-23)

- 25/25 tests Java del módulo (unit + Pg real + simulación de feeds: los 12 pasos wfship2 de
  Mintral y los 3 estados + anulado de Exacta) y 12/12 asserts SQL.
- Smoke HTTP end-to-end sobre el modulith levantado (auth RS256 real, dos orgs): idempotencia,
  409 de etapa paralela, 400 de recurso fantasma, aislamiento entre tenants, tablero proyectando
  el vocabulario del tenant, versionado dejando la película completa.
- El pipeline de Exacta evolucionado (todo por API) corrió en el n8n real en modo seco contra la
  hoja productiva.
