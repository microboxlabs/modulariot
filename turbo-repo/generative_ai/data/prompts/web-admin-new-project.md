You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Build a Supabase-style **Create Project Wizard** for ModularIoT.

* Route: `/org/<orgId>/projects/new` (full-page centered card).

* Fields & sections:

  | # | Field                                | Notes                                                                  |
  | - | ------------------------------------ | ---------------------------------------------------------------------- |
  | 1 | **Organization**                     | Dropdown (pre-select current org)                                      |
  | 2 | **Project name**                     | Required, slug-safe; becomes sub-domain & DB name                      |
  | 3 | **Region**                           | Select (`us-east`, `us-west`, `eu-central`, `ap-southeast`)            |
  | 4 | **Postgres Password**                | Hidden input with “Generate password” helper                           |
  | 5 | **Security Options** *(collapsible)* | • **Ingest API + Conn String** (default)  <br>• Only Conn String       |
  | 6 | **Ingest API Schema**                | Radio: *public* (default) / *dedicated* (disables if Only Conn String) |
  | 7 | **Advanced** *(collapsible)*         | **DB Engine**: Postgres (default) / Postgres + Vector Ext (alpha)      |

* Buttons: **Cancel** • **Create project** (primary).

* On submit, call `POST /api/projects` → creates row in DB & returns location header to `/org/<orgId>/project/<projectId>`.

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15 (App Router) + TypeScript
Tailwind CSS + shadcn/ui + lucide-react icons
Form: `react-hook-form` + `zod` validation
Prisma ORM in `packages/db`

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
packages/db/
└─ schema.prisma               (ensure `Project`, `Region`, relations)

apps/web-admin/
└─ app/
├─ components/
│   ├─ CreateProjectForm.tsx        ← `"use client"` wizard form
│   └─ PasswordGenerator.tsx        ← helper button
├─ api/
│   └─ projects/route.ts            ← POST handler (create project)
└─ (org)/\[orgId]/projects/
├─ new/page.tsx                 ← wraps `<CreateProjectForm />`
└─ page.tsx                     ← (List) “Projects placeholder” **TODO**

────────────────────────────────────────────
VISUAL / UX RULES
────────────────────────────────────────────
• Wizard width: `max-w-lg`, `rounded-2xl`, `border`, `p-8`, `gap-6`.
• Section headings: `text-sm font-semibold text-muted-foreground`.
• Collapsibles: Flowbite **Accordion** components.
• Disabled radio group greyed when parent toggle deselected.
• Generate-password helper fills field with 32-char random.
• Submit button shows loading spinner until redirect.

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• `"use client"` in `CreateProjectForm.tsx`.
• Use `useRouter().push()` after successful POST.
• Slugify project name with `slugify` util (`/[a-z0-9-]{3,20}/`).
• Region options hard-coded for now; mark with `// TODO fetch from API`.
• API handler validates body via `projectSchema` (zod) and inserts:

```ts
await prisma.project.create({
  data: {
    id: cuid(),
    name,
    slug,
    region,
    dbPassword: hashedPw,
    organizationId,
  }
})
```

• Return `201` + `{ projectId }` JSON.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────

1. Print concise **directory tree** of all new / updated files.
2. Then output each file in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
```

Include `// TODO:` placeholders where deeper logic will be added.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
