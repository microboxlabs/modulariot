# Contributing to ModularIoT

Thanks for your interest in contributing to ModularIoT! This guide covers how to
set up your environment, the repository layout, and our development workflow.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Repository Layout

ModularIoT is a four-workspace monorepo:

| Workspace | Role | Stack |
|-----------|------|-------|
| `quarkus-srv/` | **Integration** — data ingestion, real-time monitoring, anomaly detection | Quarkus, Java 21, PostgreSQL |
| `ecm-srv/` | **Coordinator** — workflows, document management, compliance | Alfresco ECM |
| `turbo-repo/` | **Frontend** — dashboards, admin UI, documentation | Next.js, TypeScript, npm |
| `miot-harness/` | **AI harness** — ASK MIOT agents, tools, approvals | Python, LangChain Deep Agents |

## Prerequisites

Install the toolchains for the workspace(s) you plan to work on:

- **Node.js** (LTS) and **npm** — for `turbo-repo/`
- **Java 21** and **Maven** (use the bundled `./mvnw` wrapper) — for `quarkus-srv/`
- **Docker** — for `ecm-srv/` and local services
- **[uv](https://docs.astral.sh/uv/)** (`brew install uv`) — for `miot-harness/`

## Local Setup

### Frontend (`turbo-repo/`)

```bash
cd turbo-repo
npm install
npx turbo dev
```

Useful scripts (run from `turbo-repo/`):

```bash
npm run build   # build all packages
npm run lint    # lint all code
npm run test    # run all tests
npm run format  # format with Prettier
```

### Backend (`quarkus-srv/`)

```bash
cd quarkus-srv
./mvnw quarkus:dev -pl miot-cli
```

### Coordinator (`ecm-srv/`)

```bash
cd ecm-srv
# See the workspace README for setup details.
```

### AI Harness (`miot-harness/`)

```bash
cd miot-harness
uv sync
uv run miot-harness demo "Tell me the story of delivery compliance this month."
```

## Development Workflow

### Branching

Direct pushes to `develop` and `based/develop` are blocked by a Husky
`pre-push` hook. Always work on a feature branch and open a pull request:

```bash
git checkout -b feat/short-description
```

### Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):
`type(scope): subject`. Common types: `feat`, `fix`, `docs`, `refactor`,
`test`, `chore`, `ci`. Examples:

```text
feat(app): add fleet status widget
fix(bff): handle empty connection list
docs(dashboard): clarify alert thresholds
ci: paginate preview comment lookup
```

### Before opening a pull request

1. Run the relevant lint and test suites (e.g. `npm run lint` and
   `npm run test` in `turbo-repo/`).
2. Update documentation when behavior or APIs change.
3. Fill out the pull request template, linking any related issues
   (e.g. `Closes #123`).
4. Request review and address feedback.

## Reporting Issues

- **Bugs and feature requests:** open an issue using one of our
  [issue templates](https://github.com/microboxlabs/modulariot/issues/new/choose).
- **Questions and ideas:** use
  [GitHub Discussions](https://github.com/microboxlabs/modulariot/discussions).
- **Security vulnerabilities:** do **not** open a public issue — follow our
  [Security Policy](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the
[Apache License 2.0](LICENSE).
