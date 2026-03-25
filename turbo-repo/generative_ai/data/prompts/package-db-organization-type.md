You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────

1. **Extend the Prisma schema** to support:

   * `OrganizationType` (categorisation)
   * `Plan` (billing tier)
   * `Subscription` (one active per org)
2. **Refactor `Organization`** to reference `OrganizationType`.
3. Create a **seed script** that inserts default rows
   (`personal`, `business` types & `free`, `pro`, `team` plans).
4. Add a **feature-gate helper** (`can(orgId, featureKey)`) that loads the
   effective feature set from `plans` → cached in memory.

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────

* PostgreSQL + Prisma ORM
* Bun
* Types generated via `@prisma/client`
* Directory: `packages/db`

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
packages/db/
├─ prisma/
│   └─ schema.prisma            (update)
│   └─ seed.ts                  (update)
├─ src/
│   └─ client.ts                (ensure PrismaClient singleton) 
│   └─ index.ts                 (ensure PrismaClient singleton) 
└─ generated/                   (auto-generated migrations – omit content)

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• Use string `uuid` PKs (`@default(cuid())`).
• Soft-enum status for `Subscription.status`
(`active | incomplete | past_due | canceled`).
• One active sub per org → `@@unique([orgId, status], map: "unique_active_sub")
  @db.PartialIndex("status = 'active'")` (Postgres partial index).
• `OrganizationType.defaultLimits` is **JSONB** for future per-type quotas.
• Seed script runs via `pnpm db:seed`.
• Feature gating: simple in-mem Map cached for 5 min;
`import { Prisma } from '@prisma/client'`.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────

1. Print concise **directory tree** of all new / updated files.
2. Then output each file in its own fenced block:

```ts
// packages/db/<path>/<file>
<file content>
```

Include `// TODO:` where further business logic will be wired.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
