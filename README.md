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

### Deploy a batch of certified PRs

Merge certified PRs into `trunk` as usual. Pushes, completed component builds,
and the nightly schedule publish images and a stack manifest without deploying.
When the batch is complete, open **Actions → MIOT Stack Nightly / Deploy trunk →
Run workflow**, select **trunk** and either **azure** or **gke**, and run it once.
Azure uses its development targets; GKE uses its own configured environment.
Each provider has its own deployment queue, so deploy them at separate times:

```bash
gh workflow run app-nightly.yml --repo microboxlabs/modulariot --ref trunk -f deployment_provider=azure
# Run separately when GKE should receive trunk:
gh workflow run app-nightly.yml --repo microboxlabs/modulariot --ref trunk -f deployment_provider=gke
```

The manual run captures `trunk` at dispatch time. It waits up to 30 minutes for
successful CI and component builds with matching inputs, builds the app at that
commit, and sends one stack deployment request to the private deployments
repository. Later merges are left for the next deployment. Components unchanged
since an earlier successful trunk build reuse that commit's image; missing or
failed builds block deployment instead of falling back to `latest`.

The private repository owns target environments and approvals. Tagged production
releases continue to use the release train, which also selects one provider per
run. No request deploys to both Azure and GKE.

See [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md). For security issues, see our [Security Policy](SECURITY.md).

## Community

- [GitHub Issues](https://github.com/microboxlabs/modulariot/issues) — bug reports and feature requests
- [GitHub Discussions](https://github.com/microboxlabs/modulariot/discussions) — questions and ideas

## License

[Apache License 2.0](LICENSE)
