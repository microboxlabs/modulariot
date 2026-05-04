# MIOT Harness

Python-first backend scaffold for ASK MIOT agent orchestration.

This project pilots LangChain Deep Agents as a controlled ModularIoT harness:
the model can plan and narrate, while this backend owns typed tools, context,
permission checks, approvals, durable run state, and Storytelling artifacts.

## Why This Is A Root Workspace

`miot-harness/` is intentionally a sibling of `quarkus-srv/`, `ecm-srv/`, and
`turbo-repo/`.

The harness is a new backend runtime rather than a frontend package or Quarkus
module. Keeping it at the root lets it grow into a service that can be consumed
by the Next.js ASK MIOT sidebar, Quarkus APIs, Alfresco workflows, and future
workers without coupling the pilot to one existing workspace too early.

## Initial Shape

```text
src/miot_harness/
  agents/          # supervisor and specialist agent factories
  api/             # HTTP service entrypoints
  runtime/         # routing, tool execution, permissions, runs, events
  skills/          # progressive skill manifests and playbooks
  storytelling/    # MIOT story artifact contracts and renderer helpers
  tools/           # MIOT-native read/write tool implementations
  workspace/       # lightweight local workspace backend
```

## First Vertical Slice

The first pilot target remains:

> Tell me the story of delivery compliance this month and suggest one dashboard
> widget.

The scaffold includes mock MIOT tools for delivery compliance metrics, workflow
bottlenecks, story creation, widget drafting, and approval-gated dashboard patch
application.

## Setup

```bash
cd miot-harness
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

Run the local demo without requiring a model key:

```bash
miot-harness demo "Tell me the story of delivery compliance this month and suggest one dashboard widget."
```

Run the API:

```bash
uvicorn miot_harness.api.server:create_app --factory --reload
```

## Design Defaults

- Read-only tools can execute without approval.
- Mutating tools return approval requests and should only apply after a user
  decision.
- Tenant and user context must come from authenticated server context, not from
  model-provided text.
- Story artifacts are strict JSON objects with evidence references.
- Deep Agents integration lives behind an adapter so the MIOT runtime can keep
  its own tool, permission, and audit contracts.

