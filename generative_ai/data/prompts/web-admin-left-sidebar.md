
You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Build a Supabase-style **LeftSidebar** for the Organization-level UI
and ensure a corresponding **route page.tsx** exists for each link.

Sidebar items (all always visible):
1. Overview   →  /org/<orgId>
2. Teams      →  /org/<orgId>/teams
3. Billing    →  /org/<orgId>/billing
4. Usage      →  /org/<orgId>/usage
5. Settings   →  /org/<orgId>/settings

Include bottom expand / collapse toggle (persist to localStorage key
`miot_sidebar`).  No accordions.

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15 (app router), TypeScript  
Tailwind CSS + lucide-react icons  
Client components where interactive.

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ components/
   │   ├─ LeftSidebar.tsx
   │   ├─ SidebarLink.tsx
   │   └─ sidebarData.ts
   └─ (org)/
       └─ [orgId]/
           ├─ page.tsx            (Overview stub)
           ├─ teams/page.tsx
           ├─ billing/page.tsx
           ├─ usage/page.tsx
           └─ settings/page.tsx

If any of the above route files don’t already exist, **create a stub**
that simply renders a heading “<Route Name> placeholder” and a TODO note.

────────────────────────────────────────────
VISUAL / UX RULES
────────────────────────────────────────────
• Expanded width: w-60; collapsed: w-16 (icons only with tooltip).  
• Active link: primary left border + bg-primary-50 (light) / bg-slate-800 (dark).  
• Hover: bg-slate-100 / bg-slate-700.  
• Icons: LayoutDashboard, Users, CreditCard, BarChart, Settings.  
• Toggle button bottom: ChevronsLeft ↔ ChevronsRight.

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• `"use client"` for interactive components.  
• Use `usePathname()` to detect active link.  
• Read/write `localStorage("miot_sidebar")` in `useEffect`.  
• Hard-code placeholder orgId `demo` in hrefs for now
  (`/org/demo/...`) and mark with `// TODO` to parameterize later.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print concise **directory tree** of all new / updated files.  
2. Then output each file content in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
````

Include `// TODO:` where more logic will be added.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
