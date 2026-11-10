# External events

A system outside the modulith can start an organization's communication rules. It declares its event types, then
publishes events. Both go through the async job ledger (`POST /api/v1/orgs/{org}/integrations/jobs/enqueue`, M2M
token), with `executor: "modulith"`.

| Job type | Payload | Result |
| --- | --- | --- |
| `conversation.events.declare` | `source`, `contextKind`, `types[]` | Replaces every type the source declared before |
| `conversation.event` | `type`, `key`, `at`, `context`, `data`, `test` | Stores the event and starts the matching rules |

## Declare

```json
{"source": "erp", "contextKind": "service",
 "types": [{"type": "erp.order.shipped", "description": "An order left the warehouse",
            "fields": [{"name": "orderCode", "label": "Pedido", "type": "string"},
                       {"name": "photos", "type": "array"}]}]}
```

- Each type starts with `<source>.`. A type of another source or of an in-process producer is refused.
- Field types: `string` (default), `number`, `boolean`, `datetime`, `array`, `object`.
- The declared types appear in the rule editor's event catalog of that organization only.
- An invalid declaration parks the job and stores nothing.
- Enqueue it with a dedupe key made of the declaration's hash: an unchanged declaration adds no job.

## Publish

```json
{"type": "erp.order.shipped", "key": "shipment-4521", "at": "2026-11-10T12:00:00Z",
 "context": {"kind": "service", "key": "4521"}, "data": {"orderCode": "4521"}}
```

| Field | Default | Notes |
| --- | --- | --- |
| `type` | required | Must be declared for the organization |
| `key` | none | A second job with the same key is skipped. Without a key, every job is a new event |
| `at` | now | ISO-8601 instant |
| `context.kind` | the declared `contextKind` | |
| `data` | `{}` | An object. Its top-level fields are the template variables |
| `test` | `false` | A test event starts only TEST rules |

An undeclared type fails and retries with the ledger's backoff. A bad `at`, `data` or `source` parks the job.

## Teams card

A template may have a `teams` variant. A Teams step then sends this Adaptive Card instead of the plain title and
text. Every text takes `{{variables}}`. A part that renders empty is left out.

| Part | Drawn as |
| --- | --- |
| `title` | Heading |
| `subtitle`, `caption` | A bold line and a grey line under it |
| `text` | The message |
| `images.field`, `images.label` | For each `{name, url}` in that data field: the label, then the image. `{{n}}` is the image number, `{{name}}` its name |
| `facts[]` (`title`, `value`, `optional`) | A fact set. An optional fact whose value is empty or `-` is left out |
| `notes[]` | A blank line, then each note in grey |
| `actions[]` (`title`, `url`) | Open URL buttons. A button whose URL is empty is left out |

`POST /conversations/rules/{id}/simulate` returns each connection step's request `body`, so you can check a card
before the rule is on.
