# Monitores de viaje: reglas de transición

El modelo FMS guarda los estados de un viaje: las etapas se abren y se cierran con `start` y `close`. No dice
cuándo debe ocurrir cada transición. Hoy esa decisión la toma quien llama a la API: el pipeline de cada
cliente, en su propio código.

Este documento agrega al modelo las **reglas de transición**: qué evento mueve qué etapa, bajo qué condición y
con qué efectos. Las reglas se declaran en el producto, se versionan y se evalúan igual para todos los clientes.

Los valores de estado y de tipo de etapa son los de la API en inglés (`pending`, `in_progress`, `completed`;
`preparation`, `transit`, `closing`…).

## Conceptos

| Concepto | Qué es |
|---|---|
| Monitor | Conjunto versionado de reglas para una clase de viaje de un tenant |
| Regla | Disparador + condición + acciones |
| Evento | Algo que le ocurre a un viaje: un cambio de plan, una señal, un vencimiento, una etapa que cambia, un comando |
| Temporizador | El vencimiento agendado de una regla de tiempo |
| Transición | El cambio de estado que aplica una regla; queda registrado |

## Monitores

Un tenant tiene uno o más monitores, uno por clase de viaje:

| Tenant | Monitor | Para |
|---|---|---|
| exacta-01 | `servicio-directo` | Un origen, un destino, plan por horario |
| exacta-01 | `reparto` | Varias paradas, cierre por última entrega |
| mintral | `faena` | Ingreso a faena con acreditación, salida por geocerca |

**El monitor es del viaje, no del feed.**

- Cada viaje guarda `monitor_key` y `monitor_version` al crearse. Desde ahí, solo ese monitor evalúa sus eventos.
- Quien crea el viaje elige el monitor: el campo `monitor` en `POST /trips`. Lo hace igual un feed, el
  coordinador o cualquier cliente de la API.
- Si el viaje se crea sin `monitor`, se usa el selector del tenant: una lista ordenada de pares
  `(condición CEL sobre el viaje nuevo, monitor)`. Por ejemplo, `trip.orderType == 'reparto'` → `reparto`.
- Un viaje sin monitor funciona como hoy: solo se mueve por comandos.
- Una versión nueva del monitor aplica a los viajes nuevos. Los viajes abiertos se pasan a la versión nueva con
  una llamada explícita (`POST /trips/{id}/monitor`).

Un monitor puede traer un **plan de etapas por defecto**. Se usa cuando el viaje se crea sin `stages`.

## Reglas

```jsonc
{
  "key": "salida-por-gps",
  "on": "signal",
  "when": "stage.type == 'preparation' && signal.kind == 'left_origin'",
  "then": [{ "advance": "transit" }],
  "priority": 10
}
```

| Campo | Contenido |
|---|---|
| `key` | Nombre único en el monitor |
| `on` | Disparador: `plan`, `signal`, `timer`, `stage`, `command` |
| `at` | Solo con `on: timer`. CEL que devuelve la hora del vencimiento |
| `when` | CEL que devuelve un booleano. Vacío = siempre |
| `then` | Lista de acciones |
| `priority` | Orden de evaluación; menor primero |
| `active` | Para apagar una regla sin borrarla |

## Eventos

| `on` | Origen | Ejemplo |
|---|---|---|
| `plan` | Cambia el plan del viaje: horas, recursos, mandatos. Por API o por feed | El feed corre la salida 2 horas |
| `signal` | Motor GPS y, más adelante, rFMS | `left_origin`, `entered_destination`, `entered_stop` |
| `timer` | Vence un temporizador agendado por una regla | `trip.plannedStart` |
| `stage` | Una etapa se inicia o se cierra, por cualquier causa | Se cerró `unloading` |
| `command` | Una llamada directa a `start`, `close` o `cancel` | El coordinador cierra la etapa a mano |

Los comandos siguen permitidos. Se registran como eventos y las reglas `on: stage` reaccionan a su efecto.

## Contexto de las expresiones

Las condiciones se escriben en CEL, con el mismo validador que los síntomas (`RuleLanguage`). Un campo que no
existe o un tipo incorrecto se rechazan al guardar la regla.

| Variable | Contenido |
|---|---|
| `trip` | Estado, horas planificadas y reales, origen y destino, `orderType` |
| `stage` | La etapa en curso: `type`, `status`, `plannedStart`, `plannedEnd`, `actualStart`, `serviceStatus` |
| `stages` | Mapa por tipo de etapa con los mismos campos |
| `mandates` | Mandatos del viaje: `externalCode`, `status`, `orderRef` |
| `assignments` | Recursos vigentes por tipo: patente o documento, desde cuándo |
| `plan` | Último estado deseado recibido y la fila original de la fuente (`plan.source`) |
| `signal` | Solo con `on: signal`: `kind`, `geofenceId`, `at` |
| `event` | El evento que se evalúa: `on`, `at`, `actor` |
| `params` | Parámetros del monitor, por ejemplo `closeToleranceMinutes` |

No hay `now()`. La hora entra por `event.at`. Así, el mismo estado y el mismo evento dan siempre el mismo
resultado.

## Acciones

| Acción | Efecto |
|---|---|
| `advance: <tipo>` | Cierra la etapa en curso e inicia la etapa `<tipo>` |
| `start: <tipo>` / `close: <tipo>` | Inicia o cierra una etapa |
| `completeTrip` | Cierra las etapas abiertas e inicia y cierra la etapa de cierre. El viaje queda `completed` |
| `cancelTrip: <motivo>` | Anula el viaje |
| `closeMandates` | Cierra los mandatos del viaje que no tengan otros viajes abiertos |
| `alert: <clave>` | Publica una alerta para la Torre de Control. No cambia el estado |
| `invoke: <función o proceso>` | Encola un job (`async_jobs`). Al terminar, el proceso emite el evento `process.<nombre>` |

Las acciones de estado usan `StageService`, `TripService` y `MandateService`. Se aplican sus validaciones, la
proyección `trip_live` y la auditoría.

## Evaluación

Por cada evento de un viaje:

1. Se lee el viaje con lock y su monitor en la versión fijada.
2. Se toman las reglas activas del disparador del evento, en orden de prioridad, y se evalúa su `when`.
3. De la primera regla que cumple y cambia el estado se aplican sus acciones de estado. Las acciones `alert` e
   `invoke` se aplican para todas las reglas que cumplen.
4. Los cambios de etapa generan eventos `stage`, que se evalúan en la misma transacción. Hay un máximo de 5
   niveles; más es un error de la regla.
5. Se incrementa `trip.epoch`, se registra la transición y se reagendan los temporizadores.

Todo ocurre en una transacción por viaje. Si una acción falla, el viaje queda como estaba y el error se registra
en la transición.

## Temporizadores

Las reglas `on: timer` no recorren viajes. Cada vencimiento se agenda cuando se conoce.

```
miot_trips.trip_timer
  id, tenant_code, trip_id, rule_key, monitor_version,
  due_at          timestamptz   -- resultado de "at"
  epoch           int           -- trip.epoch al agendar
  claimed_until   timestamptz
índice: (due_at) WHERE claimed_until IS NULL
```

**Agendar.** Después de cada transición, o de un evento `plan`, se evalúa el `at` de cada regla de tiempo del
monitor y se guarda su `due_at`. Una regla cuyo `at` no aplica al estado nuevo no se agenda.

**Despertar.** Cada 15 segundos, en cada pod:

```sql
UPDATE miot_trips.trip_timer SET claimed_until = now() + interval '2 minutes'
WHERE id IN (SELECT id FROM miot_trips.trip_timer
             WHERE due_at <= now() AND claimed_until IS NULL
             ORDER BY due_at LIMIT 500
             FOR UPDATE SKIP LOCKED)
RETURNING *;
```

Cada temporizador reclamado se evalúa como un evento `timer`, en el mismo proceso. No se encola un job por
temporizador.

**Descartar.** Si el `epoch` del temporizador no coincide con el del viaje, el viaje cambió después de agendarlo.
El temporizador se borra sin evaluarlo.

| Caso | Carga |
|---|---|
| 10.000 viajes abiertos, 3 reglas de tiempo cada uno | 30.000 filas pendientes |
| Ningún vencimiento | Una lectura de índice cada 15 segundos |
| 500 vencimientos a la misma hora | Se procesan en 1 o 2 ciclos |
| Varios pods | `SKIP LOCKED` reparte las filas; ninguna se evalúa dos veces |

La precisión es la del ciclo: 15 segundos.

## Señales GPS

El motor GPS ya calcula `origin_visited`, `destination_visited` y `current_geofence_id` por activo. Cada cambio
de geocerca del activo asignado a un viaje (`trip_live.asset_id`) se entrega como evento `signal` a ese viaje.

## Versiones y validación

- Un monitor se edita como borrador y se publica, igual que una versión de síntoma.
- Al guardar se validan todas las expresiones contra el esquema del contexto.
- `POST /trips/monitors/{key}/simulate` vuelve a evaluar la historia de un viaje (sus eventos registrados) con el
  borrador y devuelve las transiciones que habría hecho, sin escribir.

## Datos

| Tabla | Contenido |
|---|---|
| `trip_monitor` | `tenant_code`, `key`, `version`, `status` (draft, published), `name`, `rules` (JSONB), `plan` (JSONB), `params` (JSONB) |
| `trip_monitor_selector` | `tenant_code`, `seq`, `condition` (CEL), `monitor_key` |
| `trip` | Columnas nuevas `monitor_key`, `monitor_version`, `epoch` |
| `trip_timer` | Ver Temporizadores |
| `trip_transition` | `trip_id`, `event` (JSONB), `rule_key`, `monitor_version`, `from_state`, `to_state`, `actions`, `error`, `at` |

`trip_transition` es solo de inserción y no tiene versionado.

## API

| Método | Ruta | Uso |
|---|---|---|
| GET / PUT | `/trips/monitors/{key}` | Leer o guardar el borrador |
| POST | `/trips/monitors/{key}/publish` | Publicar el borrador como versión nueva |
| POST | `/trips/monitors/{key}/simulate` | Probar el borrador contra la historia de un viaje |
| GET / PUT | `/trips/monitors/selector` | Selector del tenant |
| POST | `/trips/{id}/monitor` | Cambiar el monitor o la versión de un viaje abierto |
| POST | `/trips/{id}/signals` | Entregar una señal a un viaje |
| GET | `/trips/{id}/transitions` | Historia de transiciones con la regla que las causó |

Permisos: editar y publicar monitores es `trips:monitor.admin` (Owner y Admin). Las señales se entregan con
`trips:stage.operate`.

## Relación con el feed

- El feed declara el plan: mandato, viaje con sus etapas, recursos y horas. No inicia ni cierra etapas.
- El perfil del feed indica qué monitor usan los viajes que crea. Puede no indicar ninguno y dejar que decida el
  selector.
- Cada cambio del plan llega al viaje como evento `plan`.
- Si la fuente reporta la ejecución (por ejemplo `programado`, `en ruta`, `cerrado`), el feed la entrega como
  `command` o como `signal`, y el monitor decide.

## Ejemplo: monitor `servicio-directo` de Exacta

```jsonc
{
  "key": "servicio-directo",
  "plan": [
    { "stageType": "preparation", "serviceStatus": "ADDED" },
    { "stageType": "transit", "serviceStatus": "SCHEDULED" },
    { "stageType": "closing", "serviceStatus": "FINISHED" }
  ],
  "params": { "closeToleranceMinutes": 120, "lateDepartureMinutes": 30 },
  "rules": [
    { "key": "abrir-preparacion", "on": "plan",
      "when": "trip.status == 'planned' && stages.preparation.status == 'pending'",
      "then": [{ "start": "preparation" }] },

    { "key": "salida-por-gps", "on": "signal", "priority": 10,
      "when": "stage.type == 'preparation' && signal.kind == 'left_origin'",
      "then": [{ "advance": "transit" }] },

    { "key": "salida-atrasada", "on": "timer",
      "at": "trip.plannedStart + duration(string(params.lateDepartureMinutes) + 'm')",
      "when": "stage.type == 'preparation'",
      "then": [{ "alert": "salida_atrasada" }] },

    { "key": "llegada-por-gps", "on": "signal",
      "when": "stage.type == 'transit' && signal.kind == 'entered_destination'",
      "then": [{ "advance": "closing" }] },

    { "key": "cierre-administrativo", "on": "timer",
      "at": "stages.closing.plannedEnd + duration(string(params.closeToleranceMinutes) + 'm')",
      "when": "trip.status == 'in_progress'",
      "then": [{ "completeTrip": true }, { "closeMandates": true }] }
  ]
}
```

Con este monitor, la salida y la llegada las mueve el GPS. La hora solo genera una alerta de atraso y el cierre
administrativo después de la tolerancia.

## Preguntas abiertas

| Pregunta | Opciones |
|---|---|
| ¿Cómo llega una señal GPS a la API? | Llamada del motor a `POST /trips/{id}/signals`, o un consumidor del stream dentro del modulith |
| ¿Dónde aparecen las alertas? | Como síntoma de la Torre de Control, o como notificación con las reglas de aviso |
| ¿Un comando puede saltarse el monitor? | Siempre permitido y registrado, o permitido solo si alguna regla `on: command` lo acepta |
| ¿Cuántos niveles de eventos encadenados? | 5 propuestos |
