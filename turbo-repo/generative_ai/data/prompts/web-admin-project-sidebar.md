You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Implement a Supabase-style **Project LeftSidebar** for pages under
`/org/<orgId>/project/<projectId>`.  
Also create stub `page.tsx` files for every link if they don’t already exist.

Sidebar items (always visible inside a project scope):

1. Overview           → /org/<orgId>/project/<projectId>
2. Fleets             → /org/<orgId>/project/<projectId>/fleets
3. Devices            → /org/<orgId>/project/<projectId>/devices
4. Symptom Agent      → /org/<orgId>/project/<projectId>/agent
5. Mission Control    → /org/<orgId>/project/<projectId>/mission
6. Advisors           → /org/<orgId>/project/<projectId>/advisors
7. Reports            → /org/<orgId>/project/<projectId>/reports
8. Logs               → /org/<orgId>/project/<projectId>/logs
9. API Docs           → /org/<orgId>/project/<projectId>/docs
10. Project Settings  → /org/<orgId>/project/<projectId>/settings

Include a bottom expand / collapse toggle that persists
`localStorage("miot_project_sidebar")`.  
No accordions (flat list).

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15 (app router) • TypeScript  
Tailwind CSS (brand token **primary**) • lucide-react icons  
Client components where interactive.

────────────────────────────────────────────
FILES TO CREATE / UPDATE
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ components/
   │   ├─ ProjectSidebar.tsx
   │   ├─ ProjectSidebarLink.tsx
   │   └─ projectSidebarData.ts
   └─ (org)/
       └─ [orgId]/
           └─ project/
               └─ [projectId]/
                   ├─ page.tsx            (Overview stub)
                   ├─ fleets/page.tsx
                   ├─ devices/page.tsx
                   ├─ agent/page.tsx
                   ├─ mission/page.tsx
                   ├─ advisors/page.tsx
                   ├─ reports/page.tsx
                   ├─ logs/page.tsx
                   ├─ docs/page.tsx
                   └─ settings/page.tsx

If any route file is missing, generate a stub that renders
“<Route Name> placeholder” plus a `// TODO` note.

────────────────────────────────────────────
VISUAL / UX RULES
────────────────────────────────────────────
• Expanded width `w-60`; collapsed `w-16` (icons only, tooltip on hover).  
• Active link: left border **primary** + `bg-primary-50` (light) /
  `bg-slate-800` (dark).  
• Hover: `bg-slate-100` (light) / `bg-slate-700` (dark).  
• Icons:  
  Overview → `LayoutDashboard`  
  Fleets → `Truck`  
  Devices → `Cpu`  
  Symptom Agent → `Bot`  
  Mission Control → `Radar`  
  Advisors → `Users`  
  Reports → `FileBarChart`  
  Logs → `List`  
  API Docs → `BookOpen`  
  Project Settings → `Settings`  
• Bottom toggle button: `ChevronsLeft` ↔ `ChevronsRight`.

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• Use `"use client"` for interactive components.  
• Detect active link with `usePathname()`.  
• Persist collapsed state to `localStorage("miot_project_sidebar")` via `useEffect`.  
• Hard-code placeholder ids `orgId=demo`, `projectId=alpha`
  in hrefs for now (`/org/demo/project/alpha/...`);
  add `// TODO` to parameterize later.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print a concise **directory tree** of all new / updated files.  
2. Then output each file’s content in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
````

Insert `// TODO:` where future logic will be wired.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────