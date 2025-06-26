You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Create a responsive **Header** component that combines:

[ Left → Right ]
1. MIOT logo  (links to “/”)
2. Organization breadcrumb segment  
   • Organization name (text)  
   • Pricing-plan badge (FREE, PRO, etc.)  
   • Quick **OrgSwitcher** dropdown caret
3. “/”
4. Project breadcrumb segment  
   • Project name  
   • Quick **ProjectSwitcher** dropdown caret
5. Spacer (flex-grow)
6. **CTA buttons group**  (initial items)  
   • **“Stream Ingest”**  (primary style)  
   • Placeholder `<SaaSFeature>` button(s) – hidden in OSS build (`// TODO`)
   • Easy slot to append more buttons later
7. Feedback / bell / user avatar cluster (already exists – assume you’ll slot it in)

The bar must stretch **full width**, stick to the top, and gracefully
handle long org / project names by truncating with ellipsis.

────────────────────────────────────────────
TECH & DESIGN RULES
────────────────────────────────────────────
• Next.js 15 (app router), TypeScript  
• Tailwind CSS (brand token **primary**)  
• lucide-react icons (`ChevronDown`, `CloudUpload`, etc.)  
• Component hierarchy:

packages/ui/src/
   └─ header.tsx
   └─ org-switcher.tsx - dropdown w/ search + “All orgs” + “New org”
   └─ project-switcher.tsx - dropdown w/ search + “All projects” + “New project”
   └─ cta-buttons.tsx - houses “Stream Ingest” and future buttons

• `"use client"` on interactive components.  
• Menu popovers: Headless UI `@headlessui/react` or Flowbite `Dropdown` component.  
• Badge: `bg-primary-50 text-primary-700 dark:bg-slate-800` small pill.  
• CTA primary button: `bg-primary hover:bg-primary/90 text-white`.

────────────────────────────────────────────
DATA PLACEHOLDERS
────────────────────────────────────────────
const orgs = [{ id:"mintral", name:"Mintral", plan:"FREE" }]
const projects = [
  { id:"alpha", name:"Project Alpha" },
  { id:"beta",  name:"Project Beta" }
]
// TODO: replace with API fetch later

Active org = orgs[0];  Active project = projects[0];

────────────────────────────────────────────
FILES TO GENERATE / UPDATE
────────────────────────────────────────────
apps/web-admin/
└─ app/
   └─ layout.tsx   (update: import & render <Header /> at top)
   └─ page.tsx   (update: import & render <Header /> at top)

packages/ui/src/
   └─ header.tsx
   └─ org-switcher.tsx - dropdown w/ search + “All orgs” + “New org”
   └─ project-switcher.tsx - dropdown w/ search + “All projects” + “New project”
   └─ cta-buttons.tsx - houses “Stream Ingest” and future buttons

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• Use `next/link` for logo and breadcrumb clicks.  
• When an org/project is picked, `router.push()` to the correct path
  (`/org/<orgId>` or `/org/<orgId>/project/<projectId>`).  
• Truncate long names with `truncate` util classes (`max-w-[180px]`).  
• CTA buttons are a flex row with `gap-2`.  Conditionally hide SaaS-only
  buttons with `// TODO: OSS/SaaS toggle`.  
• No need to wire real search yet; implement simple `input` filter that
  matches `name.toLowerCase().includes(q)`.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print concise **directory tree** of files created/updated.  
2. Emit each file content in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx
<file content>
````

Leave `// TODO:` where further work is expected.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────