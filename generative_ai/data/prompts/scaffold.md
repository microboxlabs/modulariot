You are a code-gen assistant inside Cursor IDE.
Create a monorepo named **modulariot** that uses **Bun + Turborepo** for JavaScript/TypeScript
and **Maven Wrapper** for the Quarkus service.

────────────────────────────────────────────────────────
GLOBAL RULES
────────────────────────────────────────────────────────
• All TypeScript targets ES2022, `"type":"module"`.
• Root uses **Bun workspaces**; JS/TS packages inherit scripts via `turbo.json`.
• Quarkus lives in `apps/ingest-quarkus/` and builds with the Maven wrapper (`mvnw`).
• Leave TODO markers (`// TODO:` or `# TODO:`) anywhere details are omitted.
• Generate every file listed, stubbing when content isn't specified.
• Keep imports valid across workspaces.

────────────────────────────────────────────────────────
1. ROOT (project-wide OSS boilerplate)
────────────────────────────────────────────────────────
modulariot/
  .github/workflows/ci.yml          # Node + Java matrix build
  .vscode/extensions.json           # recommended plugins
  .gitignore
  .env.example
  package.json                      # root scripts: dev, build, lint, format, check-types
  turbo.json
  bun.lock                        # managed by Bun
  README.md
  LICENSE                           # MIT placeholder
  CODE_OF_CONDUCT.md                # Contributor Covenant stub
  CONTRIBUTING.md                   # dev-env setup stub
  CHANGELOG.md                      # empty (semantic-release will append)

────────────────────────────────────────────────────────
2. APPS (runnable artefacts)
────────────────────────────────────────────────────────
apps/
  # --- Existing Frontend Apps ---
  web-site/                         # Next.js 15 marketing site
    public/
    app/
      alpha-2506/
        [lang]/
          dictionaries/
            en.json
            es.json
            pt.json
          dictionaries.ts
          layout.tsx
          page.tsx
      globals.css
      layout.tsx
      page.tsx
    components/                     # React components for the site
    middleware.ts
    next.config.ts
    package.json
    Dockerfile                      # Dockerfile for deployment

  web/                              # Next.js 14 (app router)
    # ... standard Next.js structure ...
    package.json

  web-admin/                        # Next.js 14 (app router)
    # ... standard Next.js structure ...
    package.json

  docs/                             # Next.js 14 (app router) for docs
    # ... standard Next.js structure ...
    package.json

  # --- Planned Backend Services ---
  ingest-quarkus/                   # Quarkus 3 + RESTEasy Reactive
    mvnw
    mvnw.cmd
    pom.xml
    src/main/java/io/modulariot/ingest/
        IngestResource.java         # GET /api/ingest/health
    src/main/resources/application.properties
    README.md                       # local dev + native build notes

  dummy-simulator/                  # CLI that emits fake IoT events
    src/index.ts
    package.json

────────────────────────────────────────────────────────
3. PACKAGES (shared libraries & generated code)
────────────────────────────────────────────────────────
packages/
  # --- Existing Shared Packages ---
  ui/                               # React component library (e.g., shadcn/ui)
    src/
      button.tsx
      card.tsx
      code.tsx
    package.json

  eslint-config/                    # Shared ESLint configurations
    base.js
    next.js
    react-internal.js
    package.json

  typescript-config/                # Shared tsconfig files
    base.json
    nextjs.json
    react-library.json
    package.json

  # --- Planned Shared Packages ---
  db/                               # (Planned) Prisma schema + TS client
    schema.prisma
    prisma/seed.ts
    package.json

  auth/                             # (Planned) Supabase JWT helpers
    src/index.ts
    package.json

  contracts/                        # (Planned) API contracts + generated clients
    openapi.yaml                    # authoritative spec (minimal stub)
    ts/                             # ⟵ generated TypeScript client (placeholder)
    java/                           # ⟵ generated Java client  (placeholder)

────────────────────────────────────────────────────────
4. GENERATIVE AI (prompts for codegen)
────────────────────────────────────────────────────────
generative_ai/
  data/
    prompts/
      scaffold.md                   # This file!

────────────────────────────────────────────────────────
5. INFRA (GitOps) - Planned
────────────────────────────────────────────────────────
infra/
  staging/
    Pulumi.yaml                     # empty stack stub
  prod/
    Pulumi.yaml

────────────────────────────────────────────────────────
6. SCRIPTS (utilities) - Planned
────────────────────────────────────────────────────────
scripts/
  migrate-and-seed.ts               # runs Prisma migrate dev + seed "Acme Org"

────────────────────────────────────────────────────────
7. TESTS - Planned
────────────────────────────────────────────────────────
tests/
  e2e/                              # Playwright config + smoke test for /
    basic.spec.ts
  unit/                             # Vitest config + sample util test
    sum.test.ts

────────────────────────────────────────────────────────
8. CI CONFIG
────────────────────────────────────────────────────────
.github/workflows/ci.yml  – matrix build:
  job "node"   : `bun install` → `turbo run lint test build --filter=!apps/ingest-quarkus`
  job "java"   : `./apps/ingest-quarkus/mvnw -f apps/ingest-quarkus/pom.xml -B clean verify`
  job "contract-gen" (future TODO) regenerates both TS & Java clients when `packages/contracts/openapi.yaml` changes.

────────────────────────────────────────────────────────
CONTENT GUIDELINES
────────────────────────────────────────────────────────
• All JS packages include eslint + prettier config stubs.
• Quarkus service uses RESTEasy Reactive; native-image build commented in `pom.xml`.
• Each package.json has meaningful "scripts" (dev, build, lint, format).
• README sections:
  1. What is ModularIoT?
  2. Quick start (e.g. `bun dev` or `docker-compose up`)
  3. Contributing guide link
• Provide a `Dockerfile` for each runnable application in its respective directory.

────────────────────────────────────────────────────────
DELIVERABLE FORMAT
────────────────────────────────────────────────────────
1. Show the full **directory tree**.
2. Then output the **content of every file** in *separate* fenced code blocks:
   ```txt
   // path/to/file
   <file contents>
   ```
