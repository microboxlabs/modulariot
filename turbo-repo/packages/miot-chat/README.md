# @microboxlabs/miot-chat

A Copilot-style agentic chat CLI for the `miot-harness` SSE streaming API. Lives at `turbo-repo/packages/miot-chat`.

> Also reachable as `miot chat` from [`@microboxlabs/miot-cli`](../miot-cli) — the standalone bin and the `miot` subcommand share the same `runMiotChat()` library entry, so flag names, env vars, config files, and behavior are identical between the two.

## Install

Inside the monorepo it's available as a workspace package. To use the built binary directly:

```bash
cd turbo-repo/packages/miot-chat
npm run build
node ./dist/cli.js --help
```

When published, `npm i -g @microboxlabs/miot-chat` installs the `miot-chat` bin. If you already have `@microboxlabs/miot-cli` installed, `miot chat` works without a second install.

## Quick start

The CLI talks to a running `miot-harness` over the Phase A SSE surface (`POST /runs:start` + `GET /runs/{id}/stream`). Default base URL is `http://localhost:8000`.

```bash
# Interactive TUI (default in a real terminal)
miot-chat --tenant demo-tenant

# One-shot
miot-chat ask "what's in stock?" --tenant mintral --mode canned

# Resume — TUI mode opens the saved-sessions picker; piped stdin re-seeds the headless REPL
miot-chat resume

# Replay a past run offline
miot-chat runs run_abc123

# Help
miot-chat --help
```

## Interactive TUI vs headless

`miot-chat` mounts an Ink-based TUI when BOTH stdin AND stdout are TTYs and the `MIOT_CHAT_NO_TUI` env var is unset. Otherwise it falls back to a line-based REPL that reuses the existing renderer — handy for piped input (`echo "ping" | miot-chat`), CI smoke runs, and golden-output tests.

| Mode | When | What it gives you |
|---|---|---|
| **TUI** | TTY in + TTY out, no override | Multi-line editor with cursor / paste / history, persistent header bar, slash palette, modal stack (context, resume, theme, runs, approval), markdown rendering for final answers, theme support |
| **Headless** | piped stdin OR redirected stdout OR `MIOT_CHAT_NO_TUI=1` | Line-based prompt-per-newline, the legacy ANSI renderer, one-line status updates |

Force headless explicitly:

```bash
MIOT_CHAT_NO_TUI=1 miot-chat --tenant demo-tenant
```

## TUI features

- **Header bar**: tenant · user · conv (short id) · mode · baseUrl · profile · pending-approvals count. Warns in yellow on `mode=agentic` + non-`mintral` tenant.
- **Multi-line input editor** with bracketed-paste support, cursor movement (arrows, ctrl-arrow word jumps, home/end), backspace + forward-delete, kill-line, and an in-memory history ring (200 entries, file-backed at `~/.miot-chat/history`). Up/Down arrows recall history when the buffer is empty; `Alt-Enter` adds a newline; plain `Enter` submits.
- **Live transcript** with structured per-event items: tool start/complete collapse to one line with a spinner, freshness warnings show inline, routes/agent turns/plans dim in. Completed turns flush into Ink's `<Static>` so they live in terminal scrollback.
- **Slash-command palette**: type `/` to filter commands by substring, Tab completes the unique match, Enter dispatches.
- **Modals**: `/context`, `/resume`, `/theme`, `/runs`, and (behind `MIOT_CHAT_APPROVALS_UI=1`) `/approve`. Esc dismisses.
- **Themes**: `dark` (default), `light`, `high-contrast` builtins, or your own token overrides via `~/.miot-chat/config.json` (see Configuration below). `/theme` opens a picker; `/theme <name>` jumps to it.
- **Markdown rendering** for final assistant answers — headings, bold/italic, fenced code blocks, lists, and links render as Ink components.

## Slash commands

All slash commands work in the TUI palette. The headless REPL supports the legacy subset (`/exit`, `/reset`, `/mode`, `/tenant`, `/save`) for backwards compatibility.

| Command | Where | Effect |
|---|---|---|
| `/help` | both | List every registered command |
| `/exit` (or Ctrl-D) | both | Persist the session and exit |
| `/clear` | both | Clear the on-screen transcript (conversation id kept) |
| `/reset` | both | Mint a fresh `conversation_id` |
| `/mode auto\|canned\|meta\|agentic` | both | Change dispatch mode |
| `/tenant <id>` | both | Change tenant |
| `/user <id>` | TUI | Change user id |
| `/save <path>` | both | Dump `{conversation_id, transcript}` as JSON |
| `/export <path>` | TUI | Write the transcript as markdown |
| `/context` | TUI | Open a modal with the full session metadata |
| `/whoami` | TUI | Print `user=… tenant=… conv=…` |
| `/theme [name]` | TUI | Pick a color theme (modal); `/theme dark` jumps directly |
| `/resume` | TUI | Pick a saved session from `~/.miot-chat/sessions/` |
| `/runs` | TUI | Pick a run from the current session to replay |
| `/approve <approve\|deny\|later> <id>` | TUI | Resolve a pending approval from the keyboard |

`Ctrl-C` aborts the in-flight harness run and keeps the editor alive.

## Configuration

`~/.miot-chat/config.json` (file mode 0600):

```json
{
  "defaultProfile": "local",
  "profiles": {
    "local":   { "baseUrl": "http://localhost:8000", "token": null, "tenantId": "demo-tenant", "userId": "demo-user" },
    "staging": { "baseUrl": "https://...",           "token": null, "tenantId": "mintral",     "userId": "ops" }
  },
  "theme": "dark"
}
```

The `theme` field is optional. Valid values:

- A builtin name: `"dark"`, `"light"`, or `"high-contrast"`.
- An object: `{ "name": "dark", "tokens": { "accent": "#ff0080", "prompt": "magenta" } }`. Token keys: `accent`, `assistant`, `user`, `dim`, `warn`, `err`, `ok`, `border`, `prompt`, `spinner`. Values are anything Ink's `<Text color>` accepts (named or hex). Invalid theme names degrade to `dark` with a one-line warning rendered above the transcript.

Resolution precedence: CLI flag > env (`MIOT_CHAT_*`) > profile > defaults.

Env vars:

| Var | Effect |
|---|---|
| `MIOT_CHAT_BASE_URL` | Override `baseUrl` |
| `MIOT_CHAT_TOKEN` | Override bearer token |
| `MIOT_CHAT_TENANT_ID` | Override tenant |
| `MIOT_CHAT_USER_ID` | Override user |
| `MIOT_CHAT_MODE` | Override dispatch mode |
| `MIOT_CHAT_PROFILE` | Pick a profile from the config file |
| `MIOT_CHAT_NO_TUI` | `1` forces headless mode even in a TTY |
| `MIOT_CHAT_APPROVALS_UI` | `1` enables the `approval.requested` modal (reply transport not yet wired) |
| `NO_COLOR` | Disable ANSI output in the headless renderer |

## Conversation memory

Each session mints a fresh `conversation_id` (UUIDv4) and sends it on every turn. Phase 13's `ConversationStore` on the harness rehydrates prior turns server-side, so the CLI carries no per-turn state.

- The **TUI** auto-persists each committed turn to `~/.miot-chat/sessions/<conv-id>.json` (mode 0600, atomic write). `/resume` lists the newest 10 and re-seeds the reducer via `LOAD_SESSION`. The 500-most-recent items are kept; older entries are summarized into a single `(elided N earlier items)` system row.
- The **headless** REPL keeps using `~/.miot-chat/last-conversation` (single id) for the legacy `miot-chat resume` flow.

## Develop

```bash
npm run build         # tsup
npm test              # vitest
npm run lint
npm run check-types
```

## Design notes

- Runtime deps: `commander` for arg parsing, `ink@^7` + `react@^19.2` for the TUI, `marked@^14` for the lexer used by `/export` and the assistant-turn renderer, and [`@microboxlabs/miot-harness-client`](../miot-harness-client) for the HTTP + SSE work. `readline`, `crypto.randomUUID`, `fetch`, and `ReadableStream` are native on Node ≥20.
- HTTP + SSE live in the sibling library — this package owns the **interactive UX layer**. The same library powers the non-streaming `miot harness create` / `miot harness runs get` subcommands in [`miot-cli`](../miot-cli).
- **Architecture (TUI):** a pure session reducer in `src/tui/session/reducer.ts` owns `meta`, `transcript`, `pendingApprovals`, and `currentRunId`. `STREAM_EVENT` delegates to `src/tui/transcript/project.ts`, which mirrors the field-precedence rules of the legacy `renderer.ts:statusFor` but produces typed `TranscriptItem`s. Components subscribe via `useSession` and render via Ink. The same projector is reused by `/export` markdown serialization and (eventually) the `/runs` replay panel.
- **Architecture (headless):** unchanged from earlier phases — `src/repl/loop.ts` reads lines, calls `client.runs.create` + `client.runs.stream`, and pipes events through the original `(state, event) → {state, output}` renderer. Marked deprecated in the source; future work re-implements headless mode on top of `useSession`.
- The library's SSE parser surfaces the harness `event: error` frame as a thrown `MiotHarnessApiError`. Both code paths catch and render it.
- Terminal signal is `run.completed` / `run.failed`, not `answer.completed` (which the supervisor can emit more than once when a mode is denied and a fallback runs). The projector handles the dual-emit case by upserting the in-flight assistant item.
- `approval.requested` events arrive from the harness, but no reply endpoint exists yet. The modal ships behind `MIOT_CHAT_APPROVALS_UI=1` and its resolve callback only records the decision locally — wiring will land when the harness exposes the reply transport.
