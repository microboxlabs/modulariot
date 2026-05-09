# ModularIoT

Open-source platform for fleet and asset monitoring. Integrates data from hardware providers, monitors operations in real time, detects anomalies, and coordinates corrective actions.

## Architecture

Four workspaces, one monorepo:

| Workspace | Role | Stack |
|-----------|------|-------|
| `quarkus-srv/` | **Integration** — data ingestion, real-time monitoring, anomaly detection | Quarkus, Java 21, PostgreSQL |
| `ecm-srv/` | **Coordinator** — workflows, document management, compliance | Alfresco ECM |
| `turbo-repo/` | **Frontend** — dashboards, admin UI, documentation | Next.js, TypeScript |
| `miot-harness/` | **AI harness** — ASK MIOT agents, tools, approvals, Storytelling artifacts | Python, LangChain Deep Agents |

## Getting Started

See the [documentation site](turbo-repo/apps/docs/) for guides and API reference.

### Frontend

```bash
cd turbo-repo
npm install
npx turbo dev
```

### Backend

```bash
cd quarkus-srv
./mvnw quarkus:dev -pl miot-cli
```

### Coordinator

```bash
cd ecm-srv
# setup instructions TBD
```

### AI Harness

Managed with [uv](https://docs.astral.sh/uv/) (install via `brew install uv`).

```bash
cd miot-harness
uv sync
uv run miot-harness demo "Tell me the story of delivery compliance this month and suggest one dashboard widget."
```

## Contributing

See [CONTRIBUTING.md](turbo-repo/CONTRIBUTING.md).

## Community

- [GitHub Issues](https://github.com/microboxlabs/modulariot/issues) — bug reports and feature requests
- [GitHub Discussions](https://github.com/microboxlabs/modulariot/discussions) — questions and ideas

## License

[Apache License 2.0](LICENSE)
