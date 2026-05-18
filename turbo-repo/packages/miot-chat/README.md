# @microboxlabs/miot-chat

A Copilot-style agentic chat CLI for the `miot-harness` SSE streaming API. Lives at `turbo-repo/packages/miot-chat`.

## Install

Inside the monorepo it's available as a workspace package. To use the built binary directly:

```bash
cd turbo-repo/packages/miot-chat
npm run build
node ./dist/cli.js --help
```

When published, `npm i -g @microboxlabs/miot-chat` installs the `miot-chat` bin.

## Quick start

The CLI talks to a running `miot-harness` over the Phase A SSE surface (`POST /runs:start` + `GET /runs/{id}/stream`). Default base URL is `http://localhost:8000`.

```bash
# REPL (default)
miot-chat --tenant demo-tenant

# One-shot
miot-chat ask "what's in stock?" --tenant mintral --mode canned

# Resume the most recent conversation
miot-chat resume

# Replay a past run offline
miot-chat runs run_abc123

# Help
miot-chat --help
```

## Slash commands (REPL)

| Command | Effect |
|---|---|
| `/exit` or Ctrl-D | Persist `last-conversation`, exit |
| `/reset` | Mint a fresh `conversation_id` |
| `/mode auto\|canned\|meta\|agentic` | Change dispatch mode |
| `/tenant <id>` | Change tenant |
| `/save <file>` | Dump the transcript so far |
| `Ctrl-C` | Abort the in-flight turn (keeps the REPL alive) |

The CLI warns when you switch to `agentic` on a non-`mintral` tenant — the harness will deny the run.

## Configuration

`~/.miot-chat/config.json` (file mode 0600):

```json
{
  "defaultProfile": "local",
  "profiles": {
    "local":   { "baseUrl": "http://localhost:8000", "token": null, "tenantId": "demo-tenant", "userId": "demo-user" },
    "staging": { "baseUrl": "https://...",           "token": null, "tenantId": "mintral",     "userId": "ops" }
  }
}
```

Resolution precedence: CLI flag > env (`MIOT_CHAT_*`) > profile > defaults.

Env vars: `MIOT_CHAT_BASE_URL`, `MIOT_CHAT_TOKEN`, `MIOT_CHAT_TENANT_ID`, `MIOT_CHAT_USER_ID`, `MIOT_CHAT_MODE`, `MIOT_CHAT_PROFILE`. `NO_COLOR` disables ANSI output (and switches status lines to one-per-line for clean logs).

## Conversation memory

Each REPL session mints a fresh `conversation_id` (UUIDv4) and sends it on every turn. Phase 13's `ConversationStore` on the harness rehydrates prior turns server-side, so the CLI carries no per-turn state. `/exit` persists the id to `~/.miot-chat/last-conversation`; `miot-chat resume` re-seeds the REPL with it.

## Develop

```bash
npm run build         # tsup
npm test              # vitest
npm run lint
npm run check-types
```

## Design notes

- Only runtime dep: `commander`. `fetch`, `ReadableStream`, `readline`, `crypto.randomUUID` are native on Node ≥20.
- SSE parsing is a pure async-iterator over `ReadableStream<Uint8Array>` — survives chunk-boundary splits and multi-line `data:` fields, surfaces the harness `event: error` frame as a thrown `HarnessRunError`.
- Renderer is pure: `(state, event) → {state, output}`. The REPL/ask layers are responsible for I/O and the final-answer line; the renderer only paints transient status updates.
- Terminal signal is `run.completed` / `run.failed`, not `answer.completed` (which the supervisor can emit more than once when a mode is denied and a fallback runs).
