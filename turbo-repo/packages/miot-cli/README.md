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

The CLI resolves credentials in this order (highest priority first):

| Source | Base URL | Token |
|---|---|---|
| CLI flags | `--base-url <url>` | `--token <token>` |
| Environment variables | `MIOT_BASE_URL` | `MIOT_TOKEN` |
| Dotfile (`~/.miotrc.json`) | From selected profile | From selected profile |

### Dotfile

Create `~/.miotrc.json` to store named profiles:

```json
{
  "defaultProfile": "staging",
  "profiles": {
    "staging": {
      "baseUrl": "https://staging.example.com",
      "token": "staging-token"
    },
    "production": {
      "baseUrl": "https://prod.example.com",
      "token": "prod-token"
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

## License

See [LICENSE](./LICENSE).
