You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Scaffold the **Project Settings** module for ModularIoT.

• Route root: `/org/<orgId>/project/<projectId>/settings`
• Shell with a left rail identical to Supabase:
  PROJECT SETTINGS • CONFIGURATION • BILLING sections.
• Implement **General** page fully; other items create stub pages.

GENERAL page must include:
  1. Rename project (input + Save / Cancel)
  2. Project ID (read-only + copy)
  3. Lifecycle actions
     • Restart dropdown (POST `/api/projects/:id/restart`)
     • Pause / Resume button (POST `/api/projects/:id/pause`)
  4. Usage banner (links to `/usage`)
  5. Custom Domains card (disabled on Free, “Upgrade” CTA)
  6. Transfer Project card (opens modal → TODO)
  7. Delete Project danger zone (double confirm)

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15, app router, TypeScript
Tailwind CSS + flowbite (Tabs, Dialog, Tooltip, Accordion)
Lucide icons (Copy, RefreshCw, Pause, Globe, Truck, Trash2)
Prisma ORM in `packages/db`
Zod + react-hook-form for validation

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ components/
   │   ├─ ProjectSettingsShell.tsx      ← wrapper + left rail
   │   ├─ DangerCard.tsx                ← reusable red box
   │   └─ CopyField.tsx                 ← readonly input + copy
   ├─ api/
   │   └─ projects/
   │       ├─ [id]/restart/route.ts     ← POST restart (TODO)
   │       ├─ [id]/pause/route.ts       ← POST pause/resume (TODO)
   │       └─ [id]/delete/route.ts      ← DELETE project (TODO)
   └─ org/[orgId]/project/[projectId]/settings/
       ├─ layout.tsx                    ← <ProjectSettingsShell/>
       ├─ page.tsx                      ← redirect → /general
       ├─ general/page.tsx              ← full implementation
       ├─ api-keys/page.tsx             ← stub
       ├─ data-api/page.tsx             ← stub
       ├─ authentication/page.tsx       ← stub
       ├─ storage/page.tsx              ← stub
       ├─ subscription/page.tsx         ← stub
       └─ usage/page.tsx                ← stub

────────────────────────────────────────────
VISUAL / UX RULES
────────────────────────────────────────────
• Shell width: sidebar `w-60` (expandable later), content flex-1.
• Save button disabled unless form dirty.
• Lifecycle buttons show toast success / error.
• Danger-zone card: border-red-200 bg-red-50 dark:bg-red-900/20.
• Plan gating: if plan==="free", disable Custom Domains & show CTA.

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• `"use client"` in interactive components.
• Load project & plan via `getProjectWithPlan(projectId)` helper (TODO).
• CopyField uses Clipboard API + `toast({title:'Copied'})`.
• Restart / Pause handlers: placeholder `// TODO integrate with orchestrator`.
• Delete handler soft-deletes, then redirects to `/org/<orgId>`.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print concise directory tree of all new / updated files.
2. Then output each file in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
````

Insert `// TODO` where deeper logic will be added.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────