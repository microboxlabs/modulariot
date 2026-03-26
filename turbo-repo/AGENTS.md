# AGENTS.md

## Project Overview

ModularIoT is an IoT platform built as a TypeScript monorepo using [Turborepo](https://turbo.build/repo). It consists of multiple frontend applications (Next.js), a backend-for-frontend API (Fastify), shared packages, and a PostgreSQL database managed through Prisma.

### Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  app (:3050) │  │ web-admin   │  │ docs (:3001)│  │ web-site    │
│  Next.js 16  │  │ (:3000)     │  │ Nextra      │  │ (:3040)     │
│  Main IoT UI │  │ Next.js 15  │  │ Docs site   │  │ Next.js 16  │
└──────┬───────┘  └──────┬──────┘  └─────────────┘  └─────────────┘
       │                 │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │  bff (:3030)    │
       │  Fastify 5      │
       │  Backend API     │
       └────────┬────────┘
                │
       ┌────────▼────────┐
       │  PostgreSQL      │
       │  (Prisma ORM)   │
       └─────────────────┘
```

### Key Technologies

- **Runtime:** Node.js 22+
- **Package manager:** npm 10.2.4 (monorepo managed with npm workspaces)
- **Build orchestrator:** Turborepo 2.5.4
- **Language:** TypeScript 5.8.2 (strict mode)
- **Frontend:** React 19, Next.js 15/16, Tailwind CSS 4, Flowbite React
- **Backend:** Fastify 5, Awilix (DI), Pino (logging)
- **Database:** PostgreSQL with Prisma 6.10
- **Testing:** Vitest (unit/integration), Playwright (E2E)
- **Linting:** ESLint 9, Prettier 3.5
- **CI/CD:** GitHub Actions

## Monorepo Structure

```
modulariot-tuborepo/
├── apps/
│   ├── app/          # @modulariot/app - Main IoT dashboard (Next.js 16, port 3050)
│   ├── web-admin/    # @modulariot/web-admin - Admin interface (Next.js 15, port 3000)
│   ├── docs/         # @modulariot/docs - Documentation site (Nextra, port 3001)
│   ├── bff/          # @modulariot/bff - Backend for Frontend API (Fastify, port 3030)
│   ├── web-site/     # @modulariot/web-site - Public website (Next.js 16, port 3040)
│   └── web/          # @modulariot/web - Placeholder
├── packages/
│   ├── db/           # @modulariot/db - Prisma schema, client, and migrations
│   ├── ui/           # @modulariot/ui - Shared React component library
│   ├── eslint-config/# @repo/eslint-config - Shared ESLint configurations
│   └── typescript-config/ # @repo/typescript-config - Shared TS configs
├── docker/           # Dockerfile variants for building images
├── .github/workflows/# CI/CD pipeline (ci.yaml)
├── .husky/           # Git hooks (pre-commit, pre-push)
├── turbo.json        # Turborepo task configuration
├── npm workspaces in package.json # Workspace: apps/* and packages/*
└── .env              # Root environment variables (git-ignored)
```

### Navigating Packages

- Use `npm run --workspace= <package-name> <command>` to target a specific package
- Package names are defined in each `package.json` `name` field (e.g., `@modulariot/app`, `@modulariot/bff`)
- Each app under `apps/` may have its own `AGENTS.md` with app-specific instructions — the closest file takes precedence

## Setup Commands

```bash
# Install all dependencies (use npm at the root)
npm install

# Copy environment template and configure
cp .env.example .env

# Generate Prisma client
npm turbo run db:generate

# Run database migrations (requires DATABASE_URL in packages/db/.env)
npm turbo run db:migrate
```

### Environment Variables

- Root `.env` is a Turbo global dependency — changes invalidate all caches
- `NEXT_PUBLIC_*` variables are exposed to the browser in Next.js apps
- `DATABASE_URL` goes in `packages/db/.env` (format: `postgresql://user:pass@host:port/dbname`)
- Key globals: `NEXT_PUBLIC_INGEST_URL`, `NODE_ENV`, `LOG_LEVEL`, `LOG_HANDLERS_CONFIG`

## Development Workflow

```bash
# Start all apps in parallel (watch mode, no caching)
npm dev

# Start a specific app
npm run --workspace= @modulariot/app dev        # Main app on :3050
npm run --workspace= @modulariot/web-admin dev  # Admin on :3000
npm run --workspace= @modulariot/bff dev        # BFF API on :3030
npm run --workspace= @modulariot/docs dev       # Docs on :3001
npm run --workspace= @modulariot/web-site dev   # Website on :3040
```

- Next.js apps use Turbopack for fast dev builds (`--turbopack` flag in web-admin, docs, web-site)
- The BFF uses `tsx watch` for automatic reloading
- Turbo caches `build`, `lint`, and `check-types` tasks; `dev` and `test` are never cached

## Testing Instructions

### Unit and Integration Tests (Vitest)

```bash
# Run all tests across the monorepo
npm test

# Run tests for a specific package
npm run --workspace= @modulariot/app test
npm run --workspace= @modulariot/bff test

# Run a specific test by name
npm run --workspace= @modulariot/app test -- -t "<test name>"

# Single run (non-watch mode)
npm run --workspace= @modulariot/app test:run

# Coverage report (v8 provider)
npm run --workspace= @modulariot/app test:coverage

# Visual test UI
npm run --workspace= @modulariot/app test:ui
```

- Tests use `@testing-library/react` and `jsdom` for component testing
- Test files: colocated as `*.test.ts(x)` or in `src/test/` directories
- The BFF uses `node-mocks-http` for HTTP handler testing

### End-to-End Tests (Playwright)

```bash
# Run E2E tests for web-admin
npm run --workspace= @modulariot/web-admin test:e2e
```

## Code Style

### TypeScript

- Strict mode is enabled across all packages via `@repo/typescript-config`
- Target: ES2022, `noUncheckedIndexedAccess` enabled
- Avoid `any` and `unknown`; prefer type inference
- Use Zod for runtime validation of external data
- Colocate types as `*.types.ts` files; shared types in `src/types/`

### Linting and Formatting

```bash
# Lint all packages
npm lint

# Format all TypeScript and Markdown files
npm format

# Check formatting without writing
npm run --workspace= @modulariot/app format:check

# Check for dead/unused code
npm run --workspace= @modulariot/app knip:check
```

- ESLint 9 with flat config (ESM); configs in `@repo/eslint-config`
- Prettier with `tailwindcss` plugin for class sorting
- Settings: semicolons on, double quotes, trailing commas (es5), 80 char width, 2-space indent

### Function Nesting Depth

- Do not nest functions more than 4 levels deep (SonarCloud rule)
- When JSX callback props (e.g. `onClick`, `onChange`) contain inline functions that call state setters with updater callbacks, extract handler functions at the component level
- Extract repeated JSX blocks with deep callbacks into small sub-components that receive stable handler props

### Conventions

- Feature-based organization in `src/features/` (auth, geographic-view, shipping, etc.)
- React: functional components only, no nested component definitions
- Server components by default; add `"use client"` only when needed
- SWR for data fetching, React Hook Form + Zod for forms
- Flowbite React as the primary UI component library
- Tailwind CSS utility classes for styling; use `tailwind-merge` for conditional classes
- Internationalization required for user-facing text (i18n in `src/features/i18n/`)

## Database

```bash
# Generate Prisma client after schema changes
npm run --workspace= @modulariot/db db:generate

# Create and apply a new migration
npm run --workspace= @modulariot/db db:migrate

# Deploy migrations to production
npm run --workspace= @modulariot/db db:deploy
```

- Schema: `packages/db/prisma/schema.prisma`
- Migrations: `packages/db/prisma/migrations/` (4 versions: v1.0.0 through v1.3.0)
- Models: User, Account, Session, VerificationToken, OrganizationType, Plan, Subscription
- Roles: OWNER, ADMIN, MEMBER
- Binary targets: `native` and `debian-openssl-3.0.x` (for Docker)

## Build and Deployment

### Building

```bash
# Build all packages (respects dependency graph via ^build)
npm build

# Build a specific app
npm run --workspace= @modulariot/app build
```

- Next.js apps output to `.next/` (standalone mode for Docker)
- BFF builds with tsup to `dist/` (ESM format)
- Turbo caches build outputs (`.next/**`, `dist/**`)

### Docker

Docker images are built using multi-stage Dockerfiles in `docker/`:

- `nextjs.monorepo.Dockerfile` — Primary Dockerfile for Next.js apps (used in CI)
- Build arg `APP_NAME` selects which app to build
- Base image: `node:22-alpine`
- Production images run as non-root user on port 3000

### CI/CD Pipeline (GitHub Actions)

The workflow in `.github/workflows/ci.yaml` runs on pushes to `trunk`/`main` and PRs:

1. **Lint & Type Check** — runs `turbo run lint` and `turbo run check-types` (excludes `@modulariot/web-admin`)
2. **Docker Publish** — builds and pushes images for `app`, `docs`, `web-site` to GHCR and Docker Hub
3. **Security Scan** — Trivy vulnerability scanning on published images

Tagging: `pr-<number>` for PRs, `latest` for trunk, semantic versions for tags, `sha-<hash>` always.

## Git Workflow

### Branch Protection

- Direct commits and pushes to `develop` and `based/develop` are blocked by Husky hooks
- Main branch: `trunk`

### Pre-commit Checks

The `.husky/pre-commit` hook blocks commits to protected branches. Knip dead-code checking is available but currently disabled in the hook for performance — run it manually:

```bash
npm run --workspace= @modulariot/app knip:check
```

### Before Committing

```bash
npm lint
npm run --workspace= @modulariot/app format:check
npm run --workspace= @modulariot/app test:run
npm turbo run check-types
```

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new device management page
fix: resolve map marker click handler
refactor: extract auth middleware to shared module
docs: update API endpoint documentation
```

## Pull Request Guidelines

- Title format: `[component] Brief description` (e.g., `[app] Add device filtering`)
- Keep PRs small and focused on a single concern
- All CI checks must pass: lint, type-check, Docker build
- Explain what changed, why, and how it was verified
- Run `npm run lint` and `npm test` before pushing

## BFF (Backend for Frontend) Notes

The BFF (`apps/bff/`) uses a modular architecture:

- **Modules** in `src/modules/`: auth, devices, device-types, health, ingest, organizations, symptom-configs, symptom-events, tokens, usage-billing, webhooks
- **Dependency injection** via Awilix container
- **Logging** with Pino (structured JSON)
- **API docs** auto-generated with Fastify Swagger
- **Auth** via Fastify JWT + Auth0 integration
- Entry point: `src/server.ts`

## Troubleshooting

- **Turbo cache issues:** Run `npm turbo run <task> --force` to bypass cache
- **Prisma client out of date:** Run `npm run --workspace= @modulariot/db db:generate` after pulling schema changes
- **Port conflicts:** Apps use ports 3000, 3001, 3030, 3040, 3050 — check for conflicts
- **Type errors after dependency updates:** Delete `node_modules` and run `npm install` again
- **npm overrides:** React types and luma.gl versions are pinned in root `package.json` under `overrides`

## Agent Behavior

- If a request is unclear, ask specific questions before executing
- Simple, well-defined tasks can be executed directly
- Complex changes (refactors, new features, architecture decisions) require confirming understanding before acting
- Always check existing codebase patterns before creating new abstractions
- When working in a specific app, check for a local `AGENTS.md` in that app's directory for app-specific instructions
- Do not add dependencies until they are actually needed
- Add or update tests when behavior changes, even if not explicitly requested
- Code with type errors, lint errors, or failing tests is not accepted
