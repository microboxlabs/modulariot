# ModularIoT AI-First Tooling — Strategy Overview

## Vision

Make ModularIoT services natively accessible to AI agents across all major platforms (Claude Code, ChatGPT, Gemini, Copilot, Cursor, Windsurf, and 40+ others) while remaining useful to humans, CI/CD, and scripts.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Layer 3: Agent Skill (open standard)            │
│  Universal — 40+ platforms via npx skills        │
│  SKILL.md teaches any agent the domain           │
│  Calls CLI via bash for execution                │
├──────────────────────────────────────────────────┤
│  Layer 2: MCP Server (optional, later)           │
│  For platforms that prefer native tool calls     │
│  Thin wrapper over SDK                           │
│  Claude Desktop, ChatGPT, Gemini, Copilot, etc. │
├──────────────────────────────────────────────────┤
│  Layer 1: CLI Tool (execution backbone)          │
│  @microboxlabs/miot-cli                          │
│  Humans, AI agents (via Bash), CI/CD, scripts    │
├──────────────────────────────────────────────────┤
│  Foundation: Existing TypeScript SDKs            │
│  @microboxlabs/miot-calendar-client (v0.3.0)     │
│  (future SDKs for other modules)                 │
└──────────────────────────────────────────────────┘
```

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Team fluency, SDK reuse, monorepo integration, existing pattern (sonarcloud-tools) |
| Location | `packages/miot-cli/` in monorepo | Turborepo integration, shared toolchain, workspace dependency on SDK |
| CLI framework | Commander.js | Already used in sonarcloud-tools, lightweight, well-known |
| Build tool | tsup | Existing pattern, ESM output with shebang for bin entry |
| Distribution | npm (`@microboxlabs/miot-cli`) | `npx` for agents, `npm i -g` for humans |
| Skill format | Open Agent Skills (agentskills.io) | Universal — 40+ platforms, not Claude-locked |
| MCP | Deferred to Layer 2 | Build if/when cross-platform native tool calls are needed |

## Build Order

| Phase | Deliverable | Status |
|---|---|---|
| 1 | `@microboxlabs/miot-cli` — CLI with calendar module | Planned |
| 2 | Agent Skill — open standard SKILL.md + reference docs | Planned |
| 3 | MCP Server — optional native tool interface | Future |

## Context

- **Primary consumers:** AI agents (via Bash tool / npx), then humans
- **MCP is industry standard** (Linux Foundation, adopted by OpenAI, Google, Microsoft) but pollutes agent context when always loaded
- **Agent Skills load on demand** (~100 tokens at startup, full content only when triggered) — solves context pollution
- **CLI is the universal backbone** — every layer above calls it or the SDK it wraps
