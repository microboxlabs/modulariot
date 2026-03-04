# Phase 3: MCP Server (Optional, Future)

## Goal

Build a Model Context Protocol server that exposes ModularIoT calendar operations as native tools for MCP-compatible hosts. This is the optional layer for platforms where native tool calls are preferred over CLI invocation via Bash.

## When to Build This

Build this phase when ANY of these conditions are true:

- Users want calendar access in **Claude Desktop** (chat, not coding)
- Users want calendar access in **ChatGPT** (via MCP apps)
- Users need **always-on** tool availability without skill activation
- Third-party agents or integrations need a **programmatic tool interface**
- The skill + CLI pattern proves insufficient for some workflow

Do NOT build this preemptively. The Skill + CLI covers the primary use case (AI-assisted coding and operations). MCP adds value only when the consumption pattern is different.

## Package Location

```
packages/miot-calendar-mcp/
```

## Architecture

```
┌─────────────────────────────┐
│  MCP Host (Claude Desktop,  │
│  ChatGPT, Copilot, etc.)    │
│              │               │
│         stdio transport      │
│              │               │
│  ┌───────────▼─────────────┐│
│  │  miot-calendar-mcp      ││
│  │  @modelcontextprotocol/ ││
│  │  sdk                    ││
│  │           │             ││
│  │  @microboxlabs/         ││
│  │  miot-calendar-client   ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

The MCP server imports the SDK directly — it does NOT shell out to the CLI. This keeps it fast and avoids Node startup overhead per tool call.

## Tool Definitions

### Read Operations

| Tool | Input Schema | Description |
|---|---|---|
| `miot_calendar_list` | `{ group?: string, active?: boolean }` | List all calendars |
| `miot_calendar_get` | `{ id: string }` | Get calendar details |
| `miot_slots_list` | `{ calendarId: string, from?: string, to?: string, available?: boolean }` | List slots |
| `miot_slots_get` | `{ id: string }` | Get slot details |
| `miot_bookings_list` | `{ calendarId?: string, from?: string, to?: string }` | List bookings |
| `miot_bookings_get` | `{ id: string }` | Get booking details |
| `miot_bookings_by_resource` | `{ resourceId: string }` | Bookings for a resource |
| `miot_groups_list` | `{ active?: boolean }` | List calendar groups |
| `miot_groups_get` | `{ id: string }` | Get group details |
| `miot_time_windows_list` | `{ calendarId: string }` | List time windows |
| `miot_slot_managers_list` | `{ active?: boolean }` | List slot managers |
| `miot_slot_managers_get` | `{ id: string }` | Get slot manager |
| `miot_slot_managers_runs` | `{ managerId?: string, limit?: number }` | List run history |

### Write Operations

| Tool | Input Schema | Description |
|---|---|---|
| `miot_calendar_create` | `{ code, name, description?, timezone?, groups? }` | Create calendar |
| `miot_calendar_update` | `{ id, name?, description?, timezone?, groups? }` | Update calendar |
| `miot_calendar_deactivate` | `{ id: string }` | Deactivate calendar |
| `miot_slots_generate` | `{ calendarId, from, to }` | Generate slots |
| `miot_slots_update_status` | `{ id, status: "OPEN" \| "CLOSED" }` | Update slot status |
| `miot_bookings_create` | `{ calendarId, resourceId, resourceType?, resourceLabel?, date, hour, minutes }` | Create booking |
| `miot_bookings_cancel` | `{ id: string }` | Cancel booking |
| `miot_groups_create` | `{ code, name, description? }` | Create group |
| `miot_groups_update` | `{ id, name?, description? }` | Update group |
| `miot_groups_deactivate` | `{ id: string }` | Deactivate group |
| `miot_time_windows_create` | `{ calendarId, name, startHour, endHour, validFrom, validTo?, capacity?, daysOfWeek? }` | Create time window |
| `miot_time_windows_update` | `{ calendarId, timeWindowId, ...same fields }` | Update time window |
| `miot_slot_managers_create` | `{ calendarId, daysInAdvance?, batchDays? }` | Create slot manager |
| `miot_slot_managers_update` | `{ id, daysInAdvance?, batchDays?, active? }` | Update slot manager |
| `miot_slot_managers_deactivate` | `{ id: string }` | Deactivate slot manager |
| `miot_slot_managers_run` | `{ id?: string }` | Run one or all managers |

### MCP Resources (read-only context)

| Resource URI | Description |
|---|---|
| `miot://calendar/{id}/summary` | Calendar + time windows + slot availability overview |
| `miot://calendar/{id}/upcoming` | Next 20 available slots for a calendar |

## Configuration

### Claude Desktop / Claude Code

```jsonc
// settings or claude_desktop_config.json
{
  "mcpServers": {
    "miot-calendar": {
      "command": "npx",
      "args": ["@microboxlabs/miot-calendar-mcp"],
      "env": {
        "MIOT_BASE_URL": "https://your-api.example.com",
        "MIOT_TOKEN": "your-token"
      }
    }
  }
}
```

### ChatGPT (remote MCP)

ChatGPT requires remote (HTTP/SSE) MCP servers. This would need a hosted deployment of the MCP server, which is a separate consideration.

## Project Structure

```
packages/miot-calendar-mcp/
├── src/
│   ├── index.ts              # MCP server setup, tool registration
│   ├── tools/
│   │   ├── calendars.ts      # Calendar tool handlers
│   │   ├── slots.ts          # Slot tool handlers
│   │   ├── bookings.ts       # Booking tool handlers
│   │   ├── groups.ts         # Group tool handlers
│   │   ├── time-windows.ts   # Time window tool handlers
│   │   └── slot-managers.ts  # Slot manager tool handlers
│   └── resources/
│       └── calendar.ts       # Resource handlers (summary, upcoming)
├── package.json
├── tsup.config.ts
└── README.md
```

## Dependencies

```json
{
  "dependencies": {
    "@microboxlabs/miot-calendar-client": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.x"
  }
}
```

## Context Pollution Consideration

This MCP server registers ~30 tools. Each tool definition consumes tokens in the system prompt. Mitigation strategies:

1. **Group into fewer, broader tools** — e.g., one `miot_calendar` tool with an `action` parameter instead of 30 separate tools. Trades discoverability for token efficiency.
2. **Use MCP tool filtering** — some hosts allow selecting which tools to enable per conversation.
3. **Accept the cost** — if the user has installed this MCP server, they want calendar access. ~30 tools at ~100 tokens each = ~3k tokens, which is acceptable for a dedicated integration.

The Skill + CLI approach (Phase 1 + 2) avoids this entirely by loading on demand. The MCP server is for users who prefer native tools over CLI invocation.

## Implementation Steps

### Step 1: Scaffold

- Create `packages/miot-calendar-mcp/`
- Set up tsup, TypeScript, package.json
- Install `@modelcontextprotocol/sdk`

### Step 2: Read-only tools

- Implement all list/get tools
- Test with Claude Desktop or MCP Inspector

### Step 3: Write tools

- Implement create/update/delete/run tools
- Add confirmation descriptions to destructive operations

### Step 4: Resources

- Implement summary and upcoming resources
- Test resource loading in compatible hosts

### Step 5: Publish

- `@microboxlabs/miot-calendar-mcp` on npm
- Document configuration for each supported host
