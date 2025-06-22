You are a code-gen assistant inside Cursor IDE.
Create a monorepo named **modulariot** that uses **pnpm + Turborepo** for JavaScript/TypeScript
and **Maven Wrapper** for the Quarkus service.

────────────────────────────────────────────────────────
GLOBAL RULES
────────────────────────────────────────────────────────
• All TypeScript targets ES2022, `"type":"module"`.
• Root uses **pnpm workspaces**; JS/TS packages inherit scripts via `turbo.json`.
• Quarkus lives in `apps/ingest-quarkus/` and builds with the Maven wrapper (`mvnw`).
• Leave TODO markers (`// TODO:` or `# TODO:`) anywhere details are omitted.
• Generate every file listed, stubbing when content isn’t specified.
• Keep imports valid across workspaces.

────────────────────────────────────────────────────────
1. ROOT (project-wide OSS boilerplate)
────────────────────────────────────────────────────────
modulariot/
  .github/workflows/ci.yml          # Node + Java matrix build
  .vscode/extensions.json           # recommended plugins
  .gitignore
  .env.example
  package.json                      # root scripts: lint, test, build, fmt
  pnpm-workspace.yaml
  turbo.json
  README.md
  LICENSE                           # MIT placeholder
  CODE_OF_CONDUCT.md                # Contributor Covenant stub
  CONTRIBUTING.md                   # dev-env setup stub
  CHANGELOG.md                      # empty (semantic-release will append)

────────────────────────────────────────────────────────
2. APPS (runnable artefacts)
────────────────────────────────────────────────────────
apps/
  web-admin/                        # Next.js 14 (app router)
    public/
    app/
      layout.tsx
      page.tsx
    app/api/health/route.ts         # GET /api/health → {ok:true}
    tsconfig.json
    next.config.mjs
    tailwind.config.ts
    package.json

  bff-node/                         # Fastify (or tRPC) BFF
    src/
      index.ts                      # basic “hello world” route
    tsconfig.json
    package.json

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
  ui/                               # shadcn/ui wrapper + theme
    src/Button.tsx
    package.json

  db/                               # Prisma schema + TS client
    schema.prisma
    prisma/seed.ts
    package.json

  auth/                             # Supabase JWT helpers
    src/index.ts
    package.json

  contracts/                        # API contracts + generated clients
    openapi.yaml                    # authoritative spec (minimal stub)
    ts/                             # ⟵ generated TypeScript client (placeholder)
    java/                           # ⟵ generated Java client  (placeholder)

  tsconfig/                         # base tsconfig
    tsconfig.base.json
    package.json                    # “private”: true

────────────────────────────────────────────────────────
4. INFRA (GitOps)
────────────────────────────────────────────────────────
infra/
  staging/
    Pulumi.yaml                     # empty stack stub
  prod/
    Pulumi.yaml

────────────────────────────────────────────────────────
5. SCRIPTS (utilities)
────────────────────────────────────────────────────────
scripts/
  migrate-and-seed.ts               # runs Prisma migrate dev + seed “Acme Org”

────────────────────────────────────────────────────────
6. TESTS
────────────────────────────────────────────────────────
tests/
  e2e/                              # Playwright config + smoke test for /
    basic.spec.ts
  unit/                             # Vitest config + sample util test
    sum.test.ts

────────────────────────────────────────────────────────
7. CI CONFIG
────────────────────────────────────────────────────────
.github/workflows/ci.yml  – matrix build:
  job “node”   : `pnpm install` → `turbo run lint test build --filter=!apps/ingest-quarkus`
  job “java”   : `./apps/ingest-quarkus/mvnw -f apps/ingest-quarkus/pom.xml -B clean verify`
  job “contract-gen” (future TODO) regenerates both TS & Java clients when `packages/contracts/openapi.yaml` changes.

────────────────────────────────────────────────────────
CONTENT GUIDELINES
────────────────────────────────────────────────────────
• All JS packages include eslint + prettier config stubs.
• Quarkus service uses RESTEasy Reactive; native-image build commented in `pom.xml`.
• Each package.json has meaningful `"scripts"` (dev, build, lint).
• README sections:
  1. What is ModularIoT?
  2. Quick start (docker-compose up)
  3. Contributing guide link
• Provide basic Tailwind config with shadcn preset in `packages/ui`.

────────────────────────────────────────────────────────
DELIVERABLE FORMAT
────────────────────────────────────────────────────────
1. Show the full **directory tree**.
2. Then output the **content of every file** in *separate* fenced code blocks:
   ```txt
   // path/to/file
   <file contents>
