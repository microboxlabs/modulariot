# Phase 2: Agent Skill — Open Standard

## Goal

Build an open Agent Skill ([agentskills.io](https://agentskills.io) specification) that teaches any AI agent how to interact with ModularIoT Calendar services via the CLI. The skill provides domain intelligence — the "brain" that knows when and how to compose CLI calls into meaningful workflows.

> **Design principle**: Only teach what Claude doesn't already know. Claude understands JSON, dates, REST semantics, and how to summarize data. The skill focuses on ModularIoT-specific domain knowledge, CLI invocations, and business rules.

## Architecture: One Skill per Module

The `miot-cli` is modular (calendar, devices, alerts, etc.). Each module gets its **own independent skill**. This keeps each skill under the 500-line budget, triggers precisely on relevant queries, and avoids loading device knowledge when the user asks about bookings.

| Module | Skill name | Install command | Status |
|--------|-----------|-----------------|--------|
| Calendar | `miot-calendar` | `npx skills add microboxlabs/miot-calendar` | **This phase** |
| Devices | `miot-devices` | `npx skills add microboxlabs/miot-devices` | Future |
| Alerts | `miot-alerts` | `npx skills add microboxlabs/miot-alerts` | Future |

All skills share the same CLI binary (`miot`) but teach different domain knowledge. Cross-module workflows (e.g., "book a slot for device X") work naturally when multiple skills are installed — the agent composes them.

## Distribution

```bash
# Each skill is installed independently
npx skills add microboxlabs/miot-calendar

# Works on: Claude Code, Cursor, GitHub Copilot, Windsurf, Gemini CLI, Cline, etc.
```

## Skill Location

Skills live inside the miot-cli package repo, one directory per module:

```
packages/miot-cli/
├── src/                              # CLI source (Phase 1)
├── skills/
│   ├── miot-calendar/                # Directory name MUST match `name` field
│   │   ├── SKILL.md                  # Core skill definition (< 500 lines)
│   │   └── references/
│   │       └── cli-reference.md      # Full CLI command reference (on-demand)
│   ├── miot-devices/                 # (future)
│   │   ├── SKILL.md
│   │   └── references/
│   └── miot-alerts/                  # (future)
│       ├── SKILL.md
│       └── references/
├── package.json
└── ...
```

### What NOT to include in the skill folder

- No `README.md` (that's for humans, not agents)
- No `CHANGELOG.md`, `INSTALLATION_GUIDE.md`, etc.
- Only files essential for agent execution

## SKILL.md Design

### Frontmatter (Level 1 — always loaded, ~100 tokens)

The frontmatter is the only part loaded at startup. It must tell the agent **what the skill does** and **when to use it**.

```yaml
---
name: miot-calendar
description: >
  Queries and manages ModularIoT Calendar services via the miot CLI.
  Lists calendars, checks slot availability, creates bookings, manages
  time windows, and runs slot managers. Use when the user asks about
  schedules, appointments, bookings, availability, calendar capacity,
  slot generation, or calendar configuration in their ModularIoT
  organization.
license: Apache-2.0
compatibility: >
  Requires Node.js 18+ and the @microboxlabs/miot-cli package
  (npx @microboxlabs/miot-cli or globally installed as miot).
  Requires MIOT_BASE_URL and MIOT_TOKEN env vars or ~/.miotrc.json profile.
metadata:
  author: microboxlabs
  version: "0.1.0"
---
```

**Frontmatter writing rules applied:**
- ✅ Description in **third person** ("Queries and manages…" not "I help you…")
- ✅ Includes **what it does** AND **when to trigger** (specific keywords: schedules, appointments, bookings, availability, capacity, slot generation, calendar configuration)
- ✅ `name` in **kebab-case**, no spaces, matches directory name
- ✅ `compatibility` lists runtime requirements
- ✅ `license` references the project's license

### Instructions Body (Level 2 — loaded when triggered, < 500 lines)

The SKILL.md body uses **imperative/infinitive form** and only includes knowledge Claude doesn't already have. It follows the guide's recommendation of **medium degrees of freedom** — a preferred workflow exists, but Claude can adapt to context.

#### Section 1: Prerequisites

Brief setup verification. Claude already knows how to run shell commands, so keep this minimal.

```markdown
## Prerequisites

Verify the CLI is available:
\`\`\`bash
miot --version  # or: npx @microboxlabs/miot-cli --version
\`\`\`

Configuration requires one of:
- Environment variables: `MIOT_BASE_URL` and `MIOT_TOKEN`
- Profile file: `~/.miotrc.json` (use `--profile <name>` to select)

Always pass `--output json` when calling the CLI.
```

#### Section 2: Domain Model

Only ModularIoT-specific relationships Claude can't infer:

```markdown
## Domain Model

- **Calendar** → contains **Time Windows** (recurring schedule definitions)
- **Time Windows** → define when **Slots** can be generated (hours, days of week, capacity)
- **Slots** → generated from time windows for specific dates; status: OPEN, FULL, or CLOSED
- **Bookings** → consume slots; linked to a **Resource** (vehicle, room, person, etc.)
- **Slot Managers** → automate slot generation on a rolling N-day-in-advance basis
- **Groups** → organize calendars by category (e.g., "vehicle-inspections", "room-bookings")
```

#### Section 3: Common Workflows

Step-by-step recipes for natural language queries. These are the core value of the skill — teaching the **workflow composition** that Claude can't guess.

```markdown
## Workflows

### Check availability
1. Find the calendar: `miot calendar list --output json`
2. List available slots: `miot calendar slots list --calendar <id> --from <date> --to <date> --available --output json`
3. Summarize: group by date, show times and remaining capacity

### Create a booking
1. Find available slots (as above)
2. Present options to the user — confirm before proceeding
3. Create: `miot calendar bookings create --calendar <id> --resource-id <rid> --date <date> --hour <h> --minutes <m> --output json`

### Check calendar utilization
1. List all slots for the range: `miot calendar slots list --calendar <id> --from <start> --to <end> --output json`
2. Compute: total slots, booked (FULL), available (OPEN), closed (CLOSED), utilization %

### Generate slots
1. `miot calendar slots generate --calendar <id> --from <date> --to <date> --output json`

### Look up resource bookings
1. `miot calendar bookings by-resource <resourceId> --output json`

### Run slot managers
1. `miot calendar slot-managers run --output json`

### Inspect calendar configuration
1. `miot calendar get <id> --output json`
2. `miot calendar time-windows list --calendar <id> --output json`
3. Summarize: calendar details + active time windows with schedules
```

#### Section 4: Business Rules

Constraints the agent must know to avoid errors:

```markdown
## Business Rules

- Slot generation: maximum 90-day range per request
- Time window hours: startHour < endHour, both 0–23
- Days of week: "1,2,3,4,5" where 1=Monday, 7=Sunday
- Booking requires a slot with status OPEN and remaining capacity > 0
- Always confirm with the user before write operations (create, cancel, deactivate)
```

#### Section 5: Error Handling

```markdown
## Error Handling

If the CLI returns `{ "error": { "status": <code>, "message": "..." } }`:
- **400**: Invalid parameters — explain which parameter is wrong
- **404**: Resource not found — suggest listing available resources
- **409**: Conflict (slot full, duplicate booking) — explain and suggest alternatives
- **5xx**: Server error — suggest retrying; do not retry automatically
```

#### Section 6: Reference Link

One-level-deep link to the detailed CLI reference:

```markdown
## CLI Reference

For complete flag details, return types, and JSON output examples for every command, see [cli-reference.md](references/cli-reference.md).
```

### References (Level 3 — loaded on-demand, unlimited size)

#### `references/cli-reference.md`

Full CLI command reference with all flags. Loaded only when the agent needs exact flag details. Includes a **table of contents** at the top (per guide recommendation for files > 100 lines).

```markdown
# miot-cli Calendar Module — CLI Reference

## Table of Contents
- [miot calendar list](#miot-calendar-list)
- [miot calendar get](#miot-calendar-get)
- [miot calendar create](#miot-calendar-create)
- [miot calendar update](#miot-calendar-update)
- [miot calendar deactivate](#miot-calendar-deactivate)
- [miot calendar slots list](#miot-calendar-slots-list)
- [miot calendar slots get](#miot-calendar-slots-get)
- [miot calendar slots generate](#miot-calendar-slots-generate)
- [miot calendar slots update-status](#miot-calendar-slots-update-status)
- [miot calendar bookings list](#miot-calendar-bookings-list)
- [miot calendar bookings get](#miot-calendar-bookings-get)
- [miot calendar bookings create](#miot-calendar-bookings-create)
- [miot calendar bookings cancel](#miot-calendar-bookings-cancel)
- [miot calendar bookings by-resource](#miot-calendar-bookings-by-resource)
- [miot calendar groups list](#miot-calendar-groups-list)
- [miot calendar groups get](#miot-calendar-groups-get)
- [miot calendar groups create](#miot-calendar-groups-create)
- [miot calendar groups update](#miot-calendar-groups-update)
- [miot calendar groups deactivate](#miot-calendar-groups-deactivate)
- [miot calendar time-windows list](#miot-calendar-time-windows-list)
- [miot calendar time-windows create](#miot-calendar-time-windows-create)
- [miot calendar time-windows update](#miot-calendar-time-windows-update)
- [miot calendar slot-managers list](#miot-calendar-slot-managers-list)
- [miot calendar slot-managers get](#miot-calendar-slot-managers-get)
- [miot calendar slot-managers create](#miot-calendar-slot-managers-create)
- [miot calendar slot-managers update](#miot-calendar-slot-managers-update)
- [miot calendar slot-managers deactivate](#miot-calendar-slot-managers-deactivate)
- [miot calendar slot-managers run](#miot-calendar-slot-managers-run)
- [miot calendar slot-managers runs](#miot-calendar-slot-managers-runs)

## miot calendar list
List all calendars.
| Flag | Type | Default | Description |
|------|------|---------|-------------|
| --group | string | | Filter by group code |
| --active | boolean | | Only active calendars |
| --inactive | boolean | | Only inactive calendars |
| --output | json\|table | auto | Output format |

Returns: Array of calendar objects with id, code, name, timezone, active, groups.

Example output:
\```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "code": "vehicle-inspection",
    "name": "Vehicle Inspection",
    "timezone": "America/New_York",
    "active": true,
    "groups": [{ "code": "inspections", "name": "Inspections" }]
  }
]
\```

## miot calendar slots list
...
(complete reference for every command with flags, return types, and JSON examples)
```

## Progressive Disclosure Flow

```
Agent starts conversation
  ↓
Level 1: System prompt includes skill metadata (~100 tokens, always present)
  "miot-calendar — Queries and manages ModularIoT Calendar services..."
  ↓
User asks: "What slots are available for vehicle inspection next week?"
  ↓
Level 2: Agent recognizes intent → loads SKILL.md body (< 5,000 tokens)
  Agent follows workflow recipe → calls CLI via Bash
  miot calendar list --output json
  miot calendar slots list --calendar <id> --from ... --to ... --available --output json
  ↓
Agent parses JSON → presents formatted answer to user
  ↓
(Only if agent needs exact flag details for an unfamiliar command)
  ↓
Level 3: Agent reads references/cli-reference.md (on-demand, unlimited)
```

## Writing Guidelines Checklist

Applied from [The Complete Guide to Building Skills for Claude](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf):

- [ ] **Third-person description** — "Queries and manages…" not "I help you…"
- [ ] **Trigger keywords in description** — schedules, appointments, bookings, availability, capacity, slot generation, calendar configuration
- [ ] **Body < 500 lines** — Offload detailed reference to `references/`
- [ ] **Only teach what Claude doesn't know** — No explaining JSON, dates, or REST
- [ ] **Imperative/infinitive form** — "Find the calendar", "List available slots"
- [ ] **Consistent terminology** — Always "calendar", never "schedule"; always "slot", never "timeslot"
- [ ] **No time-sensitive info** — No "as of v0.1.0" or date-based conditionals
- [ ] **One-level-deep references** — SKILL.md → cli-reference.md (no deeper nesting)
- [ ] **Table of contents** for reference files > 100 lines
- [ ] **Confirm before write ops** — Skill instructs agent to ask user before mutations
- [ ] **Forward slashes** in all file paths

## Implementation Steps

### Step 1: Create SKILL.md

- Write frontmatter with all required fields: `name`, `description`, `license`, `compatibility`, `metadata`
- Write body sections: Prerequisites, Domain Model, Workflows, Business Rules, Error Handling, Reference link
- Validate: body < 500 lines, description < 1024 chars, name matches directory

### Step 2: Create references/cli-reference.md

- Table of contents at the top
- Every command with: description, flag table, return type, JSON output example
- Derive flags and return types from the actual CLI implementation (Phase 1)

### Step 3: Validate structure

- Directory name `miot-calendar` matches frontmatter `name`
- No README.md inside skill folder
- No extraneous files
- Future skills (`miot-devices`, `miot-alerts`) follow the same structure — one directory each under `skills/`
- Validate with `skills-ref validate ./packages/miot-cli/skills/miot-calendar` (if available)

### Step 4: Build evaluations (eval-driven development)

Create 10+ test scenarios BEFORE finalizing the skill:

**Read-only scenarios:**
1. "What calendars do we have?" → triggers `calendar list`
2. "What's available next week for vehicle inspection?" → triggers availability workflow
3. "How full is the room-booking calendar this month?" → triggers utilization workflow
4. "Show me bookings for resource ABC" → triggers `bookings by-resource`
5. "What's the configuration of calendar X?" → triggers inspect workflow
6. "List all slot managers" → triggers `slot-managers list`

**Write scenarios (agent should confirm before executing):**
7. "Book a slot for vehicle VIN-123 next Tuesday at 10am" → triggers booking workflow
8. "Generate slots for next 2 weeks" → triggers `slots generate`
9. "Close slot X" → triggers `slots update-status`
10. "Run all slot managers" → triggers `slot-managers run`

**Error scenarios:**
11. "Book a slot that's already full" → should handle 409 gracefully
12. "Generate slots for 6 months" → should explain 90-day limit

### Step 5: Test with Claude Code (Claude A / Claude B method)

1. Place skill in `.claude/skills/miot-calendar/` for local testing
2. **Claude A** (this session): Refine SKILL.md based on test results
3. **Claude B** (fresh session with skill loaded): Run each evaluation scenario
4. Compare results, iterate on instructions

Test with multiple models:
- **Haiku**: Does the skill provide enough guidance for the simplest model?
- **Sonnet**: Is the skill clear and efficient?
- **Opus**: Does the skill avoid over-explaining?

### Step 6: Test cross-platform

- Verify skill works on Cursor, Windsurf (at minimum)
- Ensure CLI availability via npx works on each platform
- Test that `--output json` parsing works across agents

### Step 7: Publish

- Commit `skills/miot-calendar/` directory in the miot-cli package
- Push to GitHub — appears on skills.sh automatically
- Users install: `npx skills add microboxlabs/miot-calendar`
- Future modules follow the same pattern: `npx skills add microboxlabs/miot-devices`, etc.

## Validation Checklist (pre-publish)

From the guide's quality checklist:

### Core Quality
- [ ] Description is specific and includes trigger keywords
- [ ] Description includes BOTH what the skill does AND when to use it
- [ ] SKILL.md body < 500 lines
- [ ] Additional details in `references/` directory
- [ ] No time-sensitive information
- [ ] Consistent terminology throughout
- [ ] Workflow steps are concrete with actual CLI commands
- [ ] Reference links are one level deep from SKILL.md
- [ ] Table of contents in reference files > 100 lines

### Structure
- [ ] Directory name matches `name` field exactly (`miot-calendar`)
- [ ] Name uses lowercase, numbers, hyphens only
- [ ] File is named exactly `SKILL.md` (case-sensitive)
- [ ] No README.md inside skill folder
- [ ] No extraneous files

### Testing
- [ ] 10+ evaluation scenarios created and tested
- [ ] Tested with Haiku, Sonnet, and Opus
- [ ] Tested on at least 2 platforms (Claude Code + one other)
- [ ] Skill trigger rate > 90% on relevant queries
- [ ] Zero failed CLI calls in standard workflows

## References

- [The Complete Guide to Building Skills for Claude (PDF)](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)
- [Agent Skills Specification — agentskills.io](https://agentskills.io/specification)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
