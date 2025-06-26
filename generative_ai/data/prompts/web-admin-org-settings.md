You are a code-generation agent inside my editor.

────────────────────────────────────────────
GOAL
────────────────────────────────────────────
Build a Supabase-style **Organization Settings** page with tabs.
Each tab is routed as a child of:
`/org/<orgId>/settings`

Tabs to implement:

1. General → `/org/<orgId>/settings/general`
2. OAuth Apps → `/org/<orgId>/settings/oauth`
3. Audit Logs → `/org/<orgId>/settings/audit`
4. Legal Documents → `/org/<orgId>/settings/legal`

The tab layout uses **shadcn/ui Tabs**. Some tabs like *Audit Logs* and *SOC2/HIPAA* sections are **gated by plan**, with `// TODO gated-by-plan`.

────────────────────────────────────────────
TECH STACK
────────────────────────────────────────────
Next.js 15 (App Router), TypeScript
Tailwind CSS + shadcn/ui + lucide-react
Client components where interactive
Form validation via zod + react-hook-form

────────────────────────────────────────────
CREATE / UPDATE THESE FILES
────────────────────────────────────────────
apps/web-admin/
└─ app/
├─ components/
│   ├─ SettingsTabs.tsx        ← Shadcn Tabs with links
│   └─ DangerZone.tsx          ← Red-boxed delete org UI
└─ (org)/
└─ \[orgId]/
└─ settings/
├─ layout.tsx       ← Wrapper for tabs layout
├─ page.tsx         ← Redirects to `/general`
├─ general/page.tsx
├─ oauth/page.tsx
├─ audit/page.tsx
└─ legal/page.tsx

────────────────────────────────────────────
VISUAL / UX RULES
────────────────────────────────────────────
• Tabs: Horizontal pill-style with consistent spacing
• Danger zone: Red border + `variant="destructive"` button
• Delete button triggers `DELETE /api/org/[orgId]` (stub)
• Forms use zod validation
• Gated content shows upgrade CTA (if plan ≠ "team")
• External links open in new tab

────────────────────────────────────────────
CODING NOTES
────────────────────────────────────────────
• `"use client"` for interactive components
• Use `useParams()` for orgId (stub with `"demo"` initially)
• Use Tailwind `text-muted-foreground`, `text-sm`, `bg-slate-*`
• Components follow file-per-section principle
• Add `// TODO:` comments where API / plan logic is pending

────────────────────────────────────────────
OUTPUT FORMAT
────────────────────────────────────────────

1. Print concise **directory tree** of all new / updated files
2. Then output each file content in its own fenced block:

```tsx
// apps/web-admin/<path>/<file>.tsx  
<file content>
```

Include TODOs for logic placeholders.

────────────────────────────────────────────
BEGIN
────────────────────────────────────────────
