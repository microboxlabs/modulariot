# @microboxlabs/miot-cli

[![npm](https://img.shields.io/npm/v/@microboxlabs/miot-cli)](https://www.npmjs.com/package/@microboxlabs/miot-cli)
[![License](https://img.shields.io/npm/l/@microboxlabs/miot-cli)](./LICENSE)

Command-line interface for the ModularIoT platform. Manage calendars, bookings, slots, and more from the terminal or through AI agents.

## Installation

```bash
npm install -g @microboxlabs/miot-cli
```

Or run directly with `npx`:

```bash
npx @microboxlabs/miot-cli calendar list
```

## Configuration

### Browser Session Login

The CLI can obtain and store a platform token by opening your browser and
listening for a localhost callback. The platform can use your existing browser
session to approve the CLI login:

```bash
miot auth login
```

By default the command uses:

| Setting | Default | Override |
|---|---|---|
| Login URL | `<base-url>/app/cli/auth/login` | `--login-url` or `MIOT_LOGIN_URL` |
| Token URL for code exchange | `<base-url>/app/api/cli/auth/token` | `--token-url` or `MIOT_OAUTH_TOKEN_URL` |
| Callback URL | `http://127.0.0.1:<random>/callback` | `--callback-host`, `--callback-port` |

The platform login endpoint should use the current browser session to resolve
the user, organization, and token. It should redirect to the callback URL with
the same `state`, either `access_token` (or `token`) or a short-lived `code`,
and optionally `organization_id`/`organizationId`. If it returns a `code`, the
CLI exchanges it with the token URL.

For a standard OAuth PKCE flow, pass a client ID:

```bash
miot auth login --client-id <public-oauth-client-id>
```

OAuth mode also supports `--auth-url`, `--audience`, and `--scope`.

Use `--no-open` to print the login URL instead of opening the browser. The
received access token is written to the selected profile in `~/.miotrc.json`
with file mode `0600`.

```bash
miot auth status
miot --profile production auth logout
```

The CLI resolves credentials in this order (highest priority first):

| Source | Base URL | Token | Organization ID |
|---|---|---|
| CLI flags | `--base-url <url>` | `--token <token>` | `--organization <id>` |
| Environment variables | `MIOT_BASE_URL` | `MIOT_TOKEN` | `MIOT_ORGANIZATION_ID` |
| Dotfile (`~/.miotrc.json`) | From selected profile | From selected profile | From selected profile |

### Dotfile

Create `~/.miotrc.json` to store named profiles:

```json
{
  "defaultProfile": "staging",
  "profiles": {
    "staging": {
      "baseUrl": "https://staging.example.com",
      "token": "staging-token",
      "organizationId": "org-staging"
    },
    "production": {
      "baseUrl": "https://prod.example.com",
      "token": "prod-token",
      "organizationId": "org-production"
    }
  }
}
```

Select a profile with `--profile <name>`, or omit it to use `defaultProfile`.

## Output Modes

| Mode | Flag | Default when |
|---|---|---|
| `table` | `--output table` | stdout is a TTY (interactive terminal) |
| `json` | `--output json` | stdout is piped or redirected |

## Commands

### Calendars

```bash
miot calendar list [--group <code>] [--active] [--inactive]
miot calendar get <id>
miot calendar create --code <code> --name <name> [--timezone <tz>] [--description <desc>]
miot calendar update <id> [--code <code>] [--name <name>] [--timezone <tz>] [--description <desc>]
miot calendar deactivate <id>
```

### Slots

```bash
miot calendar slots list --calendar <id> [--from <date>] [--to <date>] [--available]
miot calendar slots get <id>
miot calendar slots generate --calendar <id> --from <date> --to <date>
miot calendar slots update-status <id> --status <OPEN|CLOSED>
```

### Bookings

```bash
miot calendar bookings list [--calendar <id>] [--from <date>] [--to <date>]
miot calendar bookings get <id>
miot calendar bookings create --calendar <id> --resource-id <id> [--resource-type <type>] [--resource-label <label>] --date <date> --hour <hour> --minutes <minutes>
miot calendar bookings cancel <id>
miot calendar bookings by-resource <resourceId>
```

### Groups

```bash
miot calendar groups list [--active]
miot calendar groups get <id>
miot calendar groups create --code <code> --name <name> [--description <desc>]
miot calendar groups update <id> [--code <code>] [--name <name>] [--description <desc>]
miot calendar groups deactivate <id>
```

### Time Windows

```bash
miot calendar time-windows list --calendar <id>
miot calendar time-windows create --calendar <id> --name <name> --start-hour <hour> --end-hour <hour> --valid-from <date> [--valid-to <date>] [--slot-duration <minutes>] [--capacity <n>] [--days-of-week <days>]
miot calendar time-windows update <calendarId> <timeWindowId> [--name <name>] [--start-hour <hour>] [--end-hour <hour>] [--valid-from <date>] [--valid-to <date>] [--slot-duration <minutes>] [--capacity <n>] [--days-of-week <days>]
```

### Slot Managers

```bash
miot calendar slot-managers list [--active]
miot calendar slot-managers get <id>
miot calendar slot-managers create --calendar <id> [--days-in-advance <n>] [--batch-days <n>]
miot calendar slot-managers update <id> [--days-in-advance <n>] [--batch-days <n>] [--active] [--no-active]
miot calendar slot-managers deactivate <id>
miot calendar slot-managers run [id]
miot calendar slot-managers runs [managerId] [--limit <n>]
```

### Connections

```bash
miot connections list
miot connections get <id>
miot connections create --name <name> --provider <type> --provider-base-url <url> --credential-profile <id> [--metadata-json <json>]
miot connections test <id> [--method <method>] [--path <path>]
```

### Credential Profiles

```bash
miot connections profiles list
miot connections profiles create --display-name <name> --auth-type <type> [--public-config-json <json>] [--secret-config-json <json>]
```

### Connection Operations

```bash
miot connections operations list <connectionId>
miot connections operations create <connectionId> --name <name> --method <method> --path <path> [--request-schema-json <json>] [--response-schema-json <json>] [--test-operation]
```

### Chat (interactive harness TUI)

`miot chat` opens an Ink-based interactive TUI against a running [`miot-harness`](../miot-harness-client). Equivalent to running the standalone [`miot-chat`](../miot-chat) bin — the CLI re-exports it as a subcommand so users don't have to install two binaries.

```bash
miot chat [--tenant <id>] [--user <id>] [--mode <auto|canned|meta|agentic>] [--profile <name>] [--harness-base-url <url>] [--harness-token <token>]
```

The flags mirror the standalone bin. Config + env precedence: CLI flag > `MIOT_CHAT_*` env > `~/.miot-chat/config.json` profile > defaults. Force the headless line-REPL fallback (no Ink) with `MIOT_CHAT_NO_TUI=1`; useful for CI or piped stdin (`echo "ping" | miot chat`).

What you get inside the TUI: multi-line editor with cursor / paste / history, persistent status bar (tenant · user · conv · mode · ctx-tokens · turns · streaming spinner), live event chain with an animated indicator on the active step, markdown rendering for final answers, theme support, session persistence at `~/.miot-chat/sessions/<conv-id>.json`, and 15 slash commands (`/help`, `/context`, `/whoami`, `/mode`, `/tenant`, `/user`, `/theme`, `/resume`, `/runs`, `/export`, `/save`, `/clear`, `/reset`, `/approve`, `/exit`). See the [miot-chat README](../miot-chat) for the full slash table.

### Harness (scriptable run verbs)

Low-level RPC surface over the harness's `/runs` endpoints. Use this for scripts, CI smoke tests, ad-hoc API probing, or wiring the harness into another non-interactive tool. No streaming, no UI — `harness create` is fire-and-forget; pair it with `harness runs get` to fetch the final record.

```bash
miot harness [--harness-base-url <url>] [--harness-token <token>] <subcommand>
```

```bash
# Dispatch a run and capture the run_id
miot harness create "what's in stock?" --tenant mintral [--user <id>] [--mode auto|canned|meta|agentic] [--conversation <id>] [--thread <id>]

# Fetch a completed run record (events + artifacts + answer)
miot harness runs get <run_id>
```

`harness create` prints `{ "run_id": "..." }` and exits; the run continues server-side. `runs get` returns the full `HarnessRunRecord` JSON, including the canonical `answer` once the run completes. Suitable for:

```bash
RUN_ID=$(miot harness create "list stock SKUs" --tenant mintral | jq -r .run_id)
miot harness runs get "$RUN_ID" | jq -r .answer
```

If you want streaming + multi-turn state instead, use `miot chat`. The two commands share the same `@microboxlabs/miot-harness-client` underneath; they differ only in what they compose on top of it.

## License

See [LICENSE](./LICENSE).
