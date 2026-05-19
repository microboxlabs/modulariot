# @microboxlabs/miot-harness-client

A zero-runtime-dep, typed HTTP + SSE client for the [`miot-harness`](../../../miot-harness) streaming API. Sibling of [`@microboxlabs/miot-calendar-client`](../miot-calendar-client) — same conventions, same tooling, different backend.

## Role in the ecosystem

This package is the **one** place where the harness HTTP + SSE contract is described in TypeScript. Every consumer — terminal, web, future tools — imports from here so they share the same types, the same error class, and the same wire-format guarantees.

```
          miot-harness backend (FastAPI)
          REST  POST /runs:start
          SSE   GET  /runs/{id}/stream
          REST  GET  /runs/{id}
                     ▲
                     │  HTTP + SSE (fetch)
       ┌──────────────────────────────────┐
       │   @microboxlabs/                  │  zero runtime deps
       │   miot-harness-client             │  dual ESM (.mjs) + CJS (.cjs)
       │   (typed, hand-written, this pkg) │  shared by every consumer
       └──────────────────────────────────┘
                ▲             ▲              ▲
                │             │              │
   ┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐
   │ @microboxlabs/   │  │ @microboxlabs/│  │  turbo-repo/    │
   │ miot-chat        │  │ miot-cli     │  │  apps/app       │
   │ live SSE REPL    │  │ scripting    │  │  (future)       │
   │ + slash commands │  │ create / get │  │  Next.js admin  │
   └──────────────────┘  └─────────────┘  └──────────────────┘
```

| Consumer | Role | Status |
|---|---|---|
| [`@microboxlabs/miot-chat`](../miot-chat) | Interactive Copilot-style REPL — owns the live SSE UX, slash commands, conversation memory. | ✅ Consumes this library |
| [`@microboxlabs/miot-cli`](../miot-cli) | Operator CLI — `miot harness create` / `miot harness runs get` for scripting; no live streaming UX. | ✅ Consumes this library |
| `turbo-repo/apps/app` | Next.js admin — can consume from server-side API routes the same way it consumes [`@microboxlabs/miot-calendar-client`](../miot-calendar-client). | 🔜 Future |

### Why a separate library (and not a folder inside `miot-chat`)

- **Single source of truth.** Anytime the backend contract evolves, exactly one TypeScript surface needs to change. Admins, CLIs, agents, and future automation cannot drift apart on event shapes or error codes.
- **Two surfaces, one engine.** The interactive REPL and the scriptable `miot harness …` subcommands share validation, error class, and request plumbing — a bug fixed inside this library is fixed everywhere at once.
- **Independent release cadence.** Bump the CLI without touching the library, or ship a new library version and let consumers adopt it on their own schedule.

This is the same shape that [`@microboxlabs/miot-calendar-client`](../miot-calendar-client) has with `miot-cli` + `apps/app` — applied to the harness's streaming surface.

## Install

Workspace consumers reference it as `"@microboxlabs/miot-harness-client": "*"`. After publish:

```bash
npm install @microboxlabs/miot-harness-client
```

## Quickstart

```ts
import {
  createMiotHarnessClient,
  MiotHarnessApiError,
} from "@microboxlabs/miot-harness-client";

const client = createMiotHarnessClient({
  baseUrl: "http://localhost:8000",
  token: process.env.MIOT_HARNESS_TOKEN ?? undefined,
});

// 1. Dispatch a run (async; returns immediately with the id)
const { run_id } = await client.runs.create({
  message: "what's in stock?",
  tenant_id: "mintral",
  mode: "agentic",
  conversation_id: crypto.randomUUID(),
});

// 2. Stream events as they arrive (SSE)
try {
  for await (const evt of client.runs.stream(run_id)) {
    console.log(evt.type, evt.message);
    if (evt.type === "run.completed" || evt.type === "run.failed") break;
  }
} catch (e) {
  if (e instanceof MiotHarnessApiError) {
    console.error(`harness error: ${e.code} — ${e.message}`);
  } else {
    throw e;
  }
}

// 3. Fetch the authoritative record for the final answer
const record = await client.runs.get(run_id);
console.log(record.answer);
```

## API surface

```ts
createMiotHarnessClient(config: ClientConfig) => MiotHarnessClient
```

| Group | Method | HTTP | Notes |
|---|---|---|---|
| `runs` | `create(body, opts?)` | `POST /runs:start` | Returns `{ run_id }` (the harness assigns the id). `opts.signal` is forwarded to `fetch`. |
| `runs` | `stream(id, opts?)` | `GET /runs/{id}/stream` | `AsyncIterable<HarnessEvent>`. Pass `opts.lastEventId` for resume; pass `opts.signal` to cancel. Throws `MiotHarnessApiError` on `event: error` frames. |
| `runs` | `get(id)` | `GET /runs/{id}` | Full `HarnessRunRecord` with `events[]`, `answer`, `artifacts`, `conversation_id`. |

### `ClientConfig`

| Field | Type | Default |
|---|---|---|
| `baseUrl` | `string` | required |
| `token` | `string \| null` | undefined — no `Authorization` header sent |
| `headers` | `Record<string, string>` | merged into every request (request-level headers win) |
| `fetch` | `typeof globalThis.fetch` | `globalThis.fetch` — pass a custom impl for testing or polyfills |

### Errors

Every failure surfaces as `MiotHarnessApiError`:

```ts
class MiotHarnessApiError extends Error {
  readonly code: string;        // "http_404" | "unknown_run_id" | "no_body" | ...
  readonly runId?: string;      // set for stream/getRun errors
  readonly body?: ErrorResponse | string;
  readonly status?: number;     // set for HTTP-origin errors
}
```

- HTTP non-2xx → `code = http_<status>`, `status` set, `body` parsed (JSON) or string fallback.
- SSE `event: error` frame → `code` = whatever the harness sent (e.g. `unknown_run_id`), `runId` set, no `status`.
- Stream body missing → `code = no_body`.
- Unparseable SSE payload → `code = unparseable_event` or `unparseable_error`.

`Error.message` is derived from `body.message ?? body.error ?? body.detail` so harness, FastAPI, and plain-text errors all surface a useful string.

## Develop

```bash
npm run build         # tsup, dual ESM (.mjs) + CJS (.cjs), dts on both
npm test              # vitest
npm run lint
npm run check-types
npm pack --dry-run    # confirm shape
```

## Design notes

- Zero runtime dependencies. `fetch`, `ReadableStream`, `TextDecoder`, `URL` are native on Node ≥18 and any modern browser.
- Dual ESM + CJS build with conditional `exports` so the package works under both `import` and `require` without `type: "module"`.
- SSE parser is a pure async iterator over `ReadableStream<Uint8Array>` — survives chunk-boundary splits, multi-line `data:` fields, `\r\n`, leading-space stripping after `:`, comment lines, and the harness's `event: error` close frame.
- Resource grouping (`runs.create / .stream / .get`) mirrors `@microboxlabs/miot-calendar-client`'s `calendars.* / slots.* / bookings.*` so future harness resources (conversations, artifacts, etc.) drop in naturally.
