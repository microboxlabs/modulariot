# Phase 1: miot-cli — CLI Tool

## Goal

Build a modular CLI (`@microboxlabs/miot-cli`) that exposes ModularIoT services to humans and AI agents. Start with the calendar module; design for future modules (devices, alerts, etc.).

## Package Location

```
packages/miot-cli/
```

## Project Structure

```
packages/miot-cli/
├── src/
│   ├── cli.ts                        # Entry point — Commander program, registers top-level commands
│   ├── config.ts                     # Config resolution: env vars → dotfile → flags
│   ├── output.ts                     # Output formatter: JSON (pipes/agents) or table (TTY/humans)
│   ├── client-factory.ts             # Creates SDK clients from resolved config
│   ├── commands/
│   │   └── calendar/
│   │       ├── index.ts              # Registers `miot calendar` and all subcommands
│   │       ├── list.ts               # miot calendar list
│   │       ├── get.ts                # miot calendar get <id>
│   │       ├── create.ts             # miot calendar create
│   │       ├── slots.ts              # miot calendar slots list|generate|update-status
│   │       ├── bookings.ts           # miot calendar bookings list|create|cancel|by-resource
│   │       ├── groups.ts             # miot calendar groups list|get|create
│   │       ├── time-windows.ts       # miot calendar time-windows list|create|update
│   │       └── slot-managers.ts      # miot calendar slot-managers list|get|run|runs
│   └── utils/
│       └── error.ts                  # Catches MiotCalendarApiError, formats for output
├── package.json
├── tsup.config.ts
└── README.md
```

## Command Tree

```
miot
├── calendar
│   ├── list [--group <code>] [--active] [--inactive]
│   ├── get <id>
│   ├── create --code <code> --name <name> [--timezone <tz>] [--description <desc>]
│   ├── update <id> --name <name> [--timezone <tz>] [--description <desc>]
│   ├── deactivate <id>
│   ├── slots
│   │   ├── list --calendar <id> [--from <date>] [--to <date>] [--available]
│   │   ├── get <id>
│   │   ├── generate --calendar <id> --from <date> --to <date>
│   │   └── update-status <id> --status <OPEN|CLOSED>
│   ├── bookings
│   │   ├── list [--calendar <id>] [--from <date>] [--to <date>]
│   │   ├── get <id>
│   │   ├── create --calendar <id> --resource-id <rid> [--resource-type <type>] [--resource-label <label>] --date <date> --hour <h> --minutes <m>
│   │   ├── cancel <id>
│   │   └── by-resource <resourceId>
│   ├── groups
│   │   ├── list [--active]
│   │   ├── get <id>
│   │   ├── create --code <code> --name <name> [--description <desc>]
│   │   ├── update <id> --name <name> [--description <desc>]
│   │   └── deactivate <id>
│   ├── time-windows
│   │   ├── list --calendar <id>
│   │   ├── create --calendar <id> --name <name> --start-hour <h> --end-hour <h> --valid-from <date> [--valid-to <date>] [--slot-duration <min>] [--capacity <n>] [--days-of-week <1,2,3,4,5>]
│   │   └── update <calendarId> <timeWindowId> [same flags as create]
│   └── slot-managers
│       ├── list [--active]
│       ├── get <id>
│       ├── create --calendar <id> [--days-in-advance <n>] [--batch-days <n>]
│       ├── update <id> [--days-in-advance <n>] [--batch-days <n>] [--active]
│       ├── deactivate <id>
│       ├── run [<id>]                  # Run one or all
│       └── runs [<managerId>] [--limit <n>]
├── (future: devices, alerts, ...)
└── Global flags:
    --base-url <url>                    # or MIOT_BASE_URL env var
    --token <token>                     # or MIOT_TOKEN env var
    --profile <name>                    # Named profile from ~/.miotrc.json
    --output json|table                 # Default: table on TTY, json on pipe
    --help
    --version
```

## Config Resolution (priority order)

1. CLI flags (`--base-url`, `--token`)
2. Environment variables (`MIOT_BASE_URL`, `MIOT_TOKEN`)
3. Profile in dotfile (`~/.miotrc.json`)

### Dotfile Format (`~/.miotrc.json`)

```json
{
  "defaultProfile": "staging",
  "profiles": {
    "staging": {
      "baseUrl": "https://staging-api.example.com",
      "token": "eyJ..."
    },
    "production": {
      "baseUrl": "https://api.example.com",
      "token": "eyJ..."
    }
  }
}
```

## Output Modes

### Table (default on TTY — for humans)

```
ID                                   CODE              NAME                 TIMEZONE    ACTIVE
550e8400-e29b-41d4-a716-446655440000 vehicle-inspection Vehicle Inspection   America/NY  true
660e8400-e29b-41d4-a716-446655440001 room-booking       Room Booking        UTC         true
```

### JSON (default on pipe / --output json — for agents)

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "vehicle-inspection",
    "name": "Vehicle Inspection",
    "timezone": "America/New_York",
    "active": true
  }
]
```

AI agents always get structured JSON. The skill or MCP server parses this output to reason over results.

## Error Handling

- Catch `MiotCalendarApiError` from the SDK
- Exit code 0 for success, 1 for client errors (4xx), 2 for server errors (5xx), 3 for config errors
- JSON mode: `{ "error": { "status": 404, "message": "Calendar not found" } }`
- Table mode: human-readable error message to stderr

## package.json

```json
{
  "name": "@microboxlabs/miot-cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "miot": "./dist/cli.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "dependencies": {
    "@microboxlabs/miot-calendar-client": "workspace:*",
    "commander": "^13.0.0"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "tsup": "^8.0.0",
    "typescript": "^5.8.2",
    "vitest": "^3.0.0"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "lint": "eslint .",
    "check-types": "tsc --noEmit"
  }
}
```

## tsup.config.ts

```ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    outDir: "dist",
    clean: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    outDir: "dist",
    dts: true,
  },
]);
```

## Implementation Steps

### Step 1: Scaffold the package

- Create `packages/miot-cli/` with package.json, tsup.config.ts, tsconfig.json
- Wire into turborepo workspace
- Verify `npm run build` works

### Step 2: Core infrastructure

- `config.ts` — env vars, dotfile, profile resolution
- `output.ts` — TTY detection, JSON/table formatting
- `client-factory.ts` — create SDK client from resolved config
- `error.ts` — unified error handling with exit codes

### Step 3: Calendar commands (iterative)

Build in this order (each is independently testable):

1. `calendar list` / `calendar get` — read-only, simple
2. `calendar groups list` / `calendar groups get` — read-only, simple
3. `calendar time-windows list` — read-only, depends on calendar
4. `calendar slots list` — read-only, most useful for agents ("what's available?")
5. `calendar bookings list` / `calendar bookings by-resource` — read-only
6. `calendar slot-managers list` / `calendar slot-managers runs` — read-only
7. `calendar create` / `calendar update` / `calendar deactivate` — write operations
8. `calendar slots generate` / `calendar slots update-status` — write operations
9. `calendar bookings create` / `calendar bookings cancel` — write operations
10. `calendar time-windows create` / `calendar time-windows update` — write operations
11. `calendar groups create` / `calendar groups update` / `calendar groups deactivate` — write
12. `calendar slot-managers create` / `calendar slot-managers update` / `calendar slot-managers deactivate` / `calendar slot-managers run` — write

### Step 4: Test coverage

- Unit tests for config resolution, output formatting, error handling
- Integration tests that mock the SDK client and verify CLI output
- Test both JSON and table output modes

### Step 5: Documentation and publish

- README.md with usage examples
- Add to monorepo's doc-sync workflow
- First npm publish as `@microboxlabs/miot-cli@0.1.0`
