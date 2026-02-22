# Phase 2: Agent Skill — Open Standard

## Goal

Build an open Agent Skill (agentskills.io specification) that teaches any AI agent how to interact with ModularIoT services via the CLI. The skill provides domain intelligence — the "brain" that knows when and how to compose CLI calls into meaningful workflows.

## Distribution

```bash
# Install on any of 40+ supported platforms
npx skills add microboxlabs/miot-cli

# Works on: Claude Code, Cursor, GitHub Copilot, Windsurf, Gemini CLI, Cline, etc.
```

## Skill Location

The skill lives inside the miot-cli package repository so it ships alongside the CLI:

```
packages/miot-cli/
├── src/                          # CLI source (Phase 1)
├── skills/
│   └── miot-calendar/
│       ├── SKILL.md              # Core skill definition
│       └── reference.md          # Full API reference (loaded on demand)
├── package.json
└── ...
```

## SKILL.md Design

### Frontmatter (always loaded — ~100 tokens)

```yaml
---
name: miot-calendar
description: >
  Query and manage ModularIoT Calendar services. List calendars, check slot
  availability, create bookings, manage time windows, and run slot managers.
  Use when the user asks about schedules, appointments, bookings, availability,
  or calendar services in their ModularIoT organization.
---
```

### Instructions Body (loaded when triggered)

The SKILL.md body teaches the agent:

1. **Prerequisites** — The CLI must be available (`npx @microboxlabs/miot-cli` or `miot` if globally installed). Config requires `MIOT_BASE_URL` and `MIOT_TOKEN` env vars or a `~/.miotrc.json` profile.

2. **Domain Model** — Brief explanation of the calendar domain:
   - Calendars contain time windows that define when slots are available
   - Slots are generated from time windows and represent bookable time units
   - Bookings consume slots and are linked to resources (vehicles, rooms, etc.)
   - Slot managers automate slot generation on a rolling basis
   - Groups organize calendars by category

3. **Common Workflows** — Step-by-step recipes for natural language queries:

   - **"What's available next week for X?"**
     1. Find the calendar: `miot calendar list --output json`
     2. List available slots: `miot calendar slots list --calendar <id> --from <monday> --to <friday> --available --output json`
     3. Summarize: group by date, show times and remaining capacity

   - **"Book a slot for resource Y"**
     1. Find available slots (as above)
     2. Present options to the user
     3. Create booking: `miot calendar bookings create --calendar <id> --resource-id <rid> --date <date> --hour <h> --minutes <m> --output json`

   - **"How full is calendar X this month?"**
     1. List all slots for the date range: `miot calendar slots list --calendar <id> --from <start> --to <end> --output json`
     2. Compute: total slots, occupied, available, percentage

   - **"Generate slots for the next 2 weeks"**
     1. `miot calendar slots generate --calendar <id> --from <today> --to <today+14> --output json`

   - **"What bookings does resource Z have?"**
     1. `miot calendar bookings by-resource <resourceId> --output json`

   - **"Run the slot managers"**
     1. `miot calendar slot-managers run --output json`

   - **"Show me the calendar setup"**
     1. `miot calendar get <id> --output json`
     2. `miot calendar time-windows list --calendar <id> --output json`
     3. Summarize: calendar details + active time windows with schedules

4. **Output Handling** — Always use `--output json` when calling the CLI. Parse the JSON to extract relevant fields. Present results to the user in a readable format (tables, summaries, counts).

5. **Error Handling** — If the CLI returns an error JSON (`{ "error": { ... } }`), explain the issue to the user in plain language. Common errors:
   - 404: resource not found
   - 409: slot is full / no capacity
   - 400: invalid parameters (date range > 90 days, invalid hours, etc.)

6. **Business Rules** — Constraints the agent should know:
   - Slot generation is limited to 90-day ranges
   - Time window hours: startHour < endHour, both 0-23
   - Days of week: "1,2,3,4,5" where 1=Monday, 7=Sunday
   - Slot status: OPEN, FULL, CLOSED
   - Booking requires an available (OPEN) slot with remaining capacity

## reference.md Design

Full CLI command reference with all flags, loaded only when the agent needs specifics:

```markdown
# miot-cli Calendar Module Reference

## miot calendar list
List all calendars.
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| --group | string | | Filter by group code |
| --active | boolean | | Only active calendars |
| --output | json\|table | auto | Output format |

Returns: Array of calendar objects with id, code, name, timezone, active, groups.

## miot calendar slots list
...
(complete reference for every command)
```

## Progressive Disclosure Flow

```
Agent starts conversation
  ↓
System prompt includes: "miot-calendar — Query and manage ModularIoT Calendar services..."
  (~100 tokens, always present)
  ↓
User asks: "What slots are available for vehicle inspection next week?"
  ↓
Agent recognizes intent → loads SKILL.md body
  (~2-3k tokens, loaded once per conversation)
  ↓
Agent follows workflow recipe → calls CLI via Bash
  miot calendar list --output json
  miot calendar slots list --calendar <id> --from ... --to ... --available --output json
  ↓
Agent parses JSON → presents formatted answer to user
  ↓
(If agent needs exact flag details) → loads reference.md
  (~5k tokens, loaded only if needed)
```

## Implementation Steps

### Step 1: Write SKILL.md

- Frontmatter with name, description
- Domain model explanation
- Workflow recipes for common queries
- Output handling instructions
- Error handling guidance
- Business rules

### Step 2: Write reference.md

- Complete CLI command reference
- Every command, every flag, every return type
- Examples of JSON output for each command

### Step 3: Test with Claude Code

- Install locally: `npx skills add ./packages/miot-cli`
- Verify skill triggers on relevant queries
- Test each workflow recipe end-to-end
- Verify progressive disclosure works (metadata → instructions → reference)

### Step 4: Test cross-platform

- Verify skill works on Cursor, Windsurf (at minimum)
- Ensure CLI availability via npx works on each platform

### Step 5: Publish

- Push to GitHub (skills/ directory in the miot-cli package)
- Appears on skills.sh automatically
- Users install: `npx skills add microboxlabs/miot-cli`
