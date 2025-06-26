You are a code-generation agent inside my editor.

────────────────────────────────────────────
OBJECTIVE
────────────────────────────────────────────
Create the **Organizations page** for ModularIoT, visually reminiscent of the Supabase
project list but with our own brand and UX touches.

• Repo location: `apps/web-admin/`
• Tech stack: Next.js 15 (app router, RSC), TypeScript, Tailwind + Flowbite-React,
  lucide-react icons, Framer Motion (≤300 ms).
• This screen lives at route `/org` and lists the orgs the signed-in user belongs to.
• Include a **“New organization”** button, search box, optional filter icon,
  and responsive card grid.
• Persistent elements: left rail nav, top bar (logo + dark/light toggle + version badge),
  simple footer.

────────────────────────────────────────────
BRAND / STYLE CHEATSHEET
────────────────────────────────────────────
Follow the Palette of `apps/web-admin/app/globals.css`

Typography
  – Headings: `font-semibold tracking-tight`
  – Body: default Tailwind sans

Component rules
  – Flowbite `Button`, `TextInput`, `Card`, `Badge`
  – Cards: `rounded-2xl shadow-md p-6 hover:ring-1 hover:ring-primary-300/60`
  – Iconography via lucide-react (`ChevronRight`, `Search`, `Filter`, etc.)

Responsive grid
  – xs: 1-col   sm: 2-col   lg: 3-col

────────────────────────────────────────────
FILE / FOLDER STRUCTURE TO GENERATE
────────────────────────────────────────────
apps/web-admin/
└─ app/
   ├─ (org)/
   │   ├─ layout.tsx           # wraps with sidebar & topbar
   │   └─ page.tsx             # Organizations screen
   ├─ components/
   │   ├─ Sidebar.tsx
   │   ├─ Topbar.tsx
   │   ├─ OrgCard.tsx
   │   └─ Footer.tsx
   └─ lib/
       └─ hooks/useOrgList.ts  # mock fetcher for now

────────────────────────────────────────────
API CONTEXT (used for typings / mock data)
────────────────────────────────────────────
GET /api/user/organizations → 
[
  {
    "id": "01HX1...",
    "name": "Mintral",
    "slug": "mintral",
    "role": "OWNER",          // OWNER | ADMIN | MEMBER
    "status": "ACTIVE",       // ACTIVE | PAUSED
    "createdAt": "2025-06-22T16:00:00Z",
    "region": "aws-us-west-2",
    "tier": "FREE"            // FREE | NANO | PRO
  }
]

────────────────────────────────────────────
UI REQUIREMENTS
────────────────────────────────────────────
1. **Header / Topbar**
   • Left: MIOT logo (click → “/”).  
   • Center: page title “Organizations”.  
   • Right: dark/light toggle, version badge (`vX.X.X`), user avatar dropdown.

2. **Sidebar (left rail)**
   Icons only (dashboard, devices, symptoms, billing, settings). Highlight “dashboard”.

3. **Main toolbar (below topbar)**
   • **New organization** button (primary, primary).  
   • Search input with Search icon placeholder “Search organizations”.  
   • Small filter icon (lucide `Filter`)—no dropdown yet; just a disabled button.

4. **Org card grid**
   • Card shows: name, region badge, tier badge, status text/icon, right chevron.  
   • Hover shadow + subtle upward motion (`Framer Motion translateY: -2`).  
   • Click handler → navigate to `/org/[slug]/project` (stub now).  
   • Show skeleton loaders while fetching.

5. **Empty state**
   If list is empty → centered illustration (lucide `Building2`) +
   text “No organizations yet” + CTA “Create your first organization”.

6. **Footer**
   Centered small text: “© 2025 ModularIoT – GitHub • Docs • Privacy”.

────────────────────────────────────────────
CODING RULES
────────────────────────────────────────────
• Use server components by default; mark search input & dark switch as `"use client"`.
• Fetch org list via `useOrgList()` hook → returns mock array (static JSON).
  Add `// TODO: replace with real fetch("/api/user/organizations")`.
• All route nav & buttons should be prepared with `next/link`.
• Accessibility: `aria-label` on buttons, badges have `title` attr, keyboard focus ring.

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────
1. Print a concise **directory tree** of generated/changed files.  
2. For each new file, output in its own fenced block:

```ts
// apps/web-admin/<path>/<file>.tsx
<file contents>
````

Replace business logic with `// TODO:` where appropriate.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
